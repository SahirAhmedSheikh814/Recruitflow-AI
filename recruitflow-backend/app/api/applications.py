import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.application import Application, ApplicationStatus
from app.models.candidate import Candidate, SourceChannel
from app.models.job import Job
from app.models.user import User, UserRole
from app.core.deps import get_current_user, require_role, get_optional_user
from app.services import storage_service
from app.services.intake_service import (
    ingest_resume,
    IntakeMetadata,
    IntakeError,
    DuplicateApplication,
)

router = APIRouter()


def _app_out(
    app: Application,
    candidate: Candidate | None = None,
    job: Job | None = None,
) -> dict:
    out = {
        "id": str(app.id),
        "candidate_id": str(app.candidate_id),
        "job_id": str(app.job_id),
        "status": app.status,
        "score": app.score,
        "classification": app.classification,
        "score_explanation": app.score_explanation,
        "created_at": app.created_at,
        "updated_at": app.updated_at,
    }
    if candidate:
        out["candidate"] = {
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "current_location": candidate.current_location,
            "linkedin_url": candidate.linkedin_url,
            "portfolio_url": candidate.portfolio_url,
            "resume_file_url": candidate.resume_file_url,
            "resume_download_url": storage_service.public_url(candidate.resume_file_url),
            "source_channel": candidate.source_channel,
            "parsed_data": candidate.parsed_data,
        }
    if job:
        out["job"] = {"id": str(job.id), "title": job.title}
    return out


# ── Candidate: submit application ─────────────────────────────────────────

@router.post("", status_code=201)
async def submit_application(
    job_id: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),
    current_location: Optional[str] = Form(None),
    linkedin_url: Optional[str] = Form(None),
    portfolio_url: Optional[str] = Form(None),
    resume: UploadFile = File(...),
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
):
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(400, "Invalid job_id")

    file_bytes = await resume.read()

    metadata = IntakeMetadata(
        job_id=job_uuid,
        email=email,
        source_channel=SourceChannel.website,
        full_name=full_name,
        phone=phone,
        current_location=current_location,
        linkedin_url=linkedin_url,
        portfolio_url=portfolio_url,
        user_id=current_user.id if current_user else None,
        content_type=resume.content_type,
    )

    try:
        result = ingest_resume(
            session, file_bytes, resume.filename or "", metadata
        )
    except DuplicateApplication:
        raise HTTPException(409, "You have already applied for this job")
    except IntakeError as exc:
        if exc.code == "file_too_large":
            status = 413
        elif exc.code == "job_unavailable":
            status = 404
        else:
            status = 400
        raise HTTPException(status, str(exc))

    return _app_out(result.application, result.candidate)


# ── Candidate: view own applications ─────────────────────────────────────

@router.get("/mine")
def my_applications(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Match the candidate by their user link OR their email. A candidate row may
    # exist without a user_id (e.g. applied as a guest, or applied before signing
    # up), so matching by user_id alone would hide those applications after the
    # user signs in again. Email is unique across candidates, so this is safe.
    candidates = session.exec(
        select(Candidate).where(
            (Candidate.user_id == current_user.id)
            | (Candidate.email == current_user.email)
        )
    ).all()
    if not candidates:
        return []

    apps: list = []
    for candidate in candidates:
        # Self-heal: link any email-matched candidate to this user so future
        # lookups resolve directly by user_id.
        if candidate.user_id is None:
            candidate.user_id = current_user.id
            session.add(candidate)

        rows = session.exec(
            select(Application).where(Application.candidate_id == candidate.id)
        ).all()
        for a in rows:
            job = session.get(Job, a.job_id)
            apps.append(_app_out(a, candidate, job))

    session.commit()
    return apps


# ── Recruiter: view applications for their jobs ───────────────────────────

@router.get("")
def list_applications(
    job_id: Optional[str] = None,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    query = select(Application)
    if job_id:
        query = query.where(Application.job_id == uuid.UUID(job_id))
    apps = session.exec(query).all()
    result = []
    for app in apps:
        candidate = session.get(Candidate, app.candidate_id)
        result.append(_app_out(app, candidate))
    return result


@router.get("/{application_id}")
def get_application(
    application_id: str,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    app = session.get(Application, uuid.UUID(application_id))
    if not app:
        raise HTTPException(404, "Application not found")
    candidate = session.get(Candidate, app.candidate_id)
    return _app_out(app, candidate)


# ── Recruiter: human-in-the-loop decision actions (Module 7) ──────────────

from pydantic import BaseModel  # noqa: E402


class RejectBulkIn(BaseModel):
    application_ids: list[str]


@router.get("/qualified/list")
def qualified_candidates(
    job_id: Optional[str] = None,
    cutoff: int = 75,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Shortlist review list: scored applications at or above ``cutoff``."""
    query = select(Application).where(Application.score >= cutoff)
    if job_id:
        query = query.where(Application.job_id == uuid.UUID(job_id))
    apps = session.exec(query).all()
    apps = sorted(apps, key=lambda a: a.score or 0, reverse=True)
    return [_app_out(a, session.get(Candidate, a.candidate_id)) for a in apps]


@router.post("/reject-bulk")
def reject_bulk(
    body: RejectBulkIn,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Reject many applications at once → Email Agent sends a rejection each."""
    from app.agents.runner import run_email_bg

    updated = 0
    for raw_id in body.application_ids:
        try:
            app = session.get(Application, uuid.UUID(raw_id))
        except ValueError:
            continue
        if not app:
            continue
        app.status = ApplicationStatus.rejected
        app.recruiter_decision_by = recruiter.id
        app.updated_at = datetime.utcnow()
        session.add(app)
        updated += 1
    session.commit()
    for raw_id in body.application_ids:
        try:
            run_email_bg(uuid.UUID(raw_id), "rejection")
        except ValueError:
            pass
    return {"rejected": updated}


@router.post("/{application_id}/shortlist")
def shortlist(
    application_id: str,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Shortlist a candidate → status=shortlisted + shortlisting email."""
    from app.agents.runner import run_email_bg

    app = session.get(Application, uuid.UUID(application_id))
    if not app:
        raise HTTPException(404, "Application not found")
    app.status = ApplicationStatus.shortlisted
    app.recruiter_decision_by = recruiter.id
    app.updated_at = datetime.utcnow()
    session.add(app)
    session.commit()
    run_email_bg(app.id, "shortlisted")
    return _app_out(app, session.get(Candidate, app.candidate_id))


class SendInterviewIn(BaseModel):
    # Optional recruiter-preferred start (ISO 8601). When omitted, the
    # Scheduling Agent books the earliest suitable slot.
    preferred_start: Optional[str] = None


@router.post("/{application_id}/send-interview")
def send_interview_invitation(
    application_id: str,
    body: SendInterviewIn | None = None,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Book an interview slot and send the invitation, then report the outcome.

    Runs the Scheduling Agent → Email Agent pipeline to completion (this sync
    endpoint executes in a threadpool, so awaiting the real result does not block
    the event loop) and returns a definitive success/failure. The pipeline only
    advances the application to ``interview_scheduled`` after the invitation email
    is actually sent, so a success here means the candidate has been emailed.
    """
    from app.agents.runner import run_scheduling_sync

    app = session.get(Application, uuid.UUID(application_id))
    if not app:
        raise HTTPException(404, "Application not found")

    result = run_scheduling_sync(app.id, preferred_start=body.preferred_start if body else None)

    if result.get("ok"):
        return {"status": "interview_scheduled", "application_id": application_id}

    stage = result.get("stage")
    if stage == "slot_unavailable":
        # The recruiter's preferred date/time conflicts with another interview or
        # falls outside working hours. Report it as a conflict with the specific
        # reason so the dashboard can show an actionable "unavailable" message.
        raise HTTPException(
            409,
            result.get("message")
            or "The selected time is unavailable. Please choose another slot.",
        )
    if stage == "email_failed":
        # Slot was booked but the invitation email could not be delivered. The
        # status was intentionally NOT advanced — tell the recruiter clearly.
        raise HTTPException(
            502,
            "The interview slot was booked, but the invitation email could not be "
            "sent. Please check email settings and try again.",
        )
    raise HTTPException(
        502,
        "Could not schedule the interview (no available slot or the scheduling "
        "agent failed). Please try again.",
    )
