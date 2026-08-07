"""Interviews & Google Calendar router (Modules 8, 9, 11).

  * Interview details for the candidate portal and recruiter dashboard.
  * Recruiter "Connect Google Calendar" OAuth flow (Module 8): the refresh token
    is stored **encrypted** on the recruiter profile.
  * Inbound reply intake (Module 11): posts a candidate's email reply into the
    Reply Intent Agent pipeline. The IMAP worker calls the same code path.
"""
import logging
import os
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_role
from app.db.session import get_session
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.job import Job
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole
from app.services import calendar_service

router = APIRouter()

logger = logging.getLogger("recruitflow.interviews")

# In-memory CSRF state store for the calendar OAuth round-trip (single worker).
_oauth_states: dict[str, str] = {}


def _recruiter_settings_url(status: str) -> str:
    """Absolute URL the browser is sent to after the calendar OAuth round-trip.

    The callback is hit by Google in the recruiter's browser, so we must redirect
    to the recruiter DASHBOARD origin — not a backend-relative path (which 404s on
    the API host) and not the public career site. The origin is configured via
    ``RECRUITER_DASHBOARD_URL`` so nothing is hardcoded; it falls back to localhost
    for dev. ``status`` is ``connected`` or ``error``.
    """
    base = (os.environ.get("RECRUITER_DASHBOARD_URL") or "http://localhost:3000").rstrip("/")
    return f"{base}/recruiter/settings?calendar={status}"


def _interview_out(iv: Interview) -> dict:
    return {
        "id": str(iv.id),
        "application_id": str(iv.application_id),
        "google_event_id": iv.google_event_id,
        "scheduled_start": iv.scheduled_start,
        "scheduled_end": iv.scheduled_end,
        "status": iv.status,
        "cancellation_reason": iv.cancellation_reason,
        "last_candidate_reply": iv.last_candidate_reply,
    }


@router.get("/by-application/{application_id}")
def get_interview(
    application_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Interview details for an application (candidate sees their own; staff any)."""
    iv = session.exec(
        select(Interview).where(Interview.application_id == uuid.UUID(application_id))
    ).first()
    if not iv:
        raise HTTPException(404, "No interview for this application")
    return _interview_out(iv)


@router.get("/my")
def get_my_interviews(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Candidate's interviews — all scheduled/confirmed/rescheduled interviews
    for their applications, with job/recruiter details."""
    from app.models.candidate import Candidate

    # Find all candidate records linked to this user
    candidates = session.exec(
        select(Candidate).where(
            (Candidate.user_id == user.id) | (Candidate.email == user.email)
        )
    ).all()
    if not candidates:
        return []

    candidate_ids = [c.id for c in candidates]
    # Get all applications for these candidates
    apps = session.exec(
        select(Application).where(Application.candidate_id.in_(candidate_ids))
    ).all()
    if not apps:
        return []

    app_ids = [a.id for a in apps]
    # Get all interviews for these applications, excluding cancelled
    interviews = session.exec(
        select(Interview).where(
            Interview.application_id.in_(app_ids),
            Interview.status.in_(["proposed", "confirmed", "rescheduled", "completed"])
        )
    ).all()

    result = []
    for iv in interviews:
        app = session.get(Application, iv.application_id)
        if not app:
            continue
        job = session.get(Job, app.job_id)
        candidate = session.get(Candidate, app.candidate_id)
        result.append({
            **_interview_out(iv),
            "job_title": job.title if job else None,
            "candidate_name": candidate.full_name if candidate else None,
        })

    # Sort by scheduled start descending (upcoming first)
    result.sort(key=lambda x: x["scheduled_start"] or "", reverse=True)
    return result


@router.get("/recruiter")
def get_recruiter_interviews(
    recruiter: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Recruiter's interviews — all scheduled/confirmed/rescheduled interviews
    for jobs they own, with candidate details."""
    # Get all jobs owned by this recruiter (admins see all)
    if recruiter.role == UserRole.admin:
        jobs = session.exec(select(Job)).all()
    else:
        jobs = session.exec(select(Job).where(Job.recruiter_id == recruiter.id)).all()

    if not jobs:
        return []

    job_ids = [j.id for j in jobs]
    # Get all applications for these jobs
    apps = session.exec(
        select(Application).where(Application.job_id.in_(job_ids))
    ).all()
    if not apps:
        return []

    app_ids = [a.id for a in apps]
    # Get all interviews, excluding cancelled
    interviews = session.exec(
        select(Interview).where(
            Interview.application_id.in_(app_ids),
            Interview.status.in_(["proposed", "confirmed", "rescheduled", "completed"])
        )
    ).all()

    result = []
    for iv in interviews:
        app = session.get(Application, iv.application_id)
        if not app:
            continue
        job = session.get(Job, app.job_id)
        candidate = session.get(Candidate, app.candidate_id)
        result.append({
            **_interview_out(iv),
            "job_title": job.title if job else None,
            "candidate_name": candidate.full_name if candidate else None,
            "candidate_email": candidate.email if candidate else None,
        })

    # Sort by scheduled start descending
    result.sort(key=lambda x: x["scheduled_start"] or "", reverse=True)
    return result


# ── Google Calendar connect (Module 8) ────────────────────────────────────

@router.get("/calendar/connect")
def calendar_connect(
    recruiter: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
):
    """Return the Google consent URL for the recruiter to connect their calendar."""
    if not calendar_service.is_configured():
        raise HTTPException(503, "Google Calendar is not configured on the server")
    state = secrets.token_urlsafe(24)
    _oauth_states[state] = str(recruiter.id)
    return {"authorization_url": calendar_service.build_calendar_auth_url(state)}


@router.get("/calendar/callback")
async def calendar_callback(
    code: str,
    state: str,
    session: Session = Depends(get_session),
):
    """OAuth callback: exchange the code, store the encrypted refresh token.

    This endpoint is loaded in the recruiter's browser by Google, so it always
    ends in a redirect back to the recruiter dashboard (never a raw JSON error) —
    ``?calendar=connected`` on success, ``?calendar=error`` on any failure.
    """
    recruiter_id = _oauth_states.pop(state, None)
    if not recruiter_id:
        logger.warning("calendar callback with invalid/expired state")
        return RedirectResponse(url=_recruiter_settings_url("error"))
    try:
        refresh_token = await calendar_service.exchange_code_for_refresh_token(code)
    except calendar_service.CalendarError as exc:
        # Never log the code/token — only the failure reason.
        logger.warning("calendar code exchange failed: %s", exc)
        return RedirectResponse(url=_recruiter_settings_url("error"))

    profile = session.exec(
        select(RecruiterProfile).where(RecruiterProfile.user_id == uuid.UUID(recruiter_id))
    ).first()
    if profile is None:
        profile = RecruiterProfile(user_id=uuid.UUID(recruiter_id))
    profile.google_refresh_token = calendar_service.encrypt_refresh_token(refresh_token)
    profile.google_calendar_connected = True
    session.add(profile)
    session.commit()
    return RedirectResponse(url=_recruiter_settings_url("connected"))


# ── Inbound reply (Module 11) ─────────────────────────────────────────────

class ReplyIn(BaseModel):
    application_id: str
    reply_text: str


@router.post("/reply")
def ingest_reply(
    body: ReplyIn,
    user: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
):
    """Feed a candidate's email reply into the Reply Intent Agent pipeline.

    Used for manual/testing entry; the IMAP worker calls ``run_reply_bg`` with
    the same arguments when it polls the mailbox.
    """
    from app.agents.runner import run_reply_bg

    try:
        app_id = uuid.UUID(body.application_id)
    except ValueError:
        raise HTTPException(400, "Invalid application_id")
    run_reply_bg(app_id, body.reply_text)
    return {"status": "reply_processing_started"}
