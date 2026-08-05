import secrets
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.core.deps import require_role
from app.models.agent_run import AgentRun
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User, UserRole
from app.models.recruiter_profile import RecruiterProfile
from app.core.security import hash_password
from app.services import storage_service

router = APIRouter()


class CreateRecruiterRequest(BaseModel):
    email: str
    full_name: str
    company_name: str | None = None


def _generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/recruiters", status_code=201)
def create_recruiter(
    body: CreateRecruiterRequest,
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    if session.exec(select(User).where(User.email == body.email)).first():
        raise HTTPException(400, "Email already registered")

    temp_password = _generate_password()
    recruiter = User(
        email=body.email,
        password_hash=hash_password(temp_password),
        full_name=body.full_name,
        role=UserRole.recruiter,
        created_by_admin_id=admin.id,
    )
    session.add(recruiter)
    session.commit()
    session.refresh(recruiter)

    session.add(RecruiterProfile(user_id=recruiter.id, company_name=body.company_name))
    session.commit()

    # Return the generated credentials once; admin shares them with the recruiter.
    return {
        "id": str(recruiter.id),
        "email": recruiter.email,
        "full_name": recruiter.full_name,
        "temp_password": temp_password,
    }


@router.get("/recruiters")
def list_recruiters(
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    recruiters = session.exec(select(User).where(User.role == UserRole.recruiter)).all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "full_name": r.full_name,
            "is_active": r.is_active,
            "created_at": r.created_at,
        }
        for r in recruiters
    ]


class ToggleActiveRequest(BaseModel):
    is_active: bool


@router.patch("/recruiters/{recruiter_id}")
def toggle_recruiter_active(
    recruiter_id: str,
    body: ToggleActiveRequest,
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    recruiter = session.get(User, uuid.UUID(recruiter_id))
    if not recruiter or recruiter.role != UserRole.recruiter:
        raise HTTPException(404, "Recruiter not found")
    recruiter.is_active = body.is_active
    session.add(recruiter)
    session.commit()
    return {"id": str(recruiter.id), "is_active": recruiter.is_active}


# ── Global read-only views for the admin dashboard (Module 13) ─────────────

@router.get("/jobs")
def list_all_jobs(
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Every job across all recruiters."""
    jobs = session.exec(select(Job)).all()
    return [
        {
            "id": str(j.id),
            "recruiter_id": str(j.recruiter_id),
            "title": j.title,
            "description": j.description,
            "required_skills": j.required_skills or [],
            "status": j.status,
            "created_at": j.created_at,
            "updated_at": j.updated_at,
        }
        for j in sorted(jobs, key=lambda j: j.created_at, reverse=True)
    ]


@router.get("/candidates")
def list_all_candidates(
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Every candidate on record."""
    candidates = session.exec(select(Candidate)).all()
    return [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "current_location": c.current_location,
            "linkedin_url": c.linkedin_url,
            "portfolio_url": c.portfolio_url,
            "source_channel": c.source_channel,
            "resume_download_url": storage_service.public_url(c.resume_file_url),
            "parsed_data": c.parsed_data,
        }
        for c in candidates
    ]


class UpdateCandidateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    current_location: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None


def _candidate_dict(c: Candidate) -> dict:
    return {
        "id": str(c.id),
        "full_name": c.full_name,
        "email": c.email,
        "phone": c.phone,
        "current_location": c.current_location,
        "linkedin_url": c.linkedin_url,
        "portfolio_url": c.portfolio_url,
        "source_channel": c.source_channel,
        "resume_download_url": storage_service.public_url(c.resume_file_url),
        "parsed_data": c.parsed_data,
    }


@router.put("/candidates/{candidate_id}")
def update_candidate(
    candidate_id: str,
    body: UpdateCandidateRequest,
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    candidate = session.get(Candidate, uuid.UUID(candidate_id))
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return _candidate_dict(candidate)


@router.delete("/candidates/{candidate_id}", status_code=204)
def delete_candidate(
    candidate_id: str,
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    candidate = session.get(Candidate, uuid.UUID(candidate_id))
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    session.delete(candidate)
    session.commit()


@router.get("/agent-runs")
def list_agent_runs(
    limit: int = 200,
    admin: User = Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Agent Activity Log — the most recent agent runs, newest first."""
    runs = session.exec(select(AgentRun)).all()
    runs = sorted(runs, key=lambda r: r.created_at, reverse=True)[: max(1, limit)]
    return [
        {
            "id": str(r.id),
            "agent_name": r.agent_name,
            "application_id": str(r.application_id) if r.application_id else None,
            "input_summary": r.input_summary,
            "output_summary": r.output_summary,
            "handed_off_to": r.handed_off_to,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in runs
    ]
