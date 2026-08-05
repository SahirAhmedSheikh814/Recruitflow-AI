from datetime import datetime
from typing import Optional, List
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.job import Job, JobStatus
from app.models.user import UserRole
from app.core.deps import require_role

router = APIRouter()


class JobCreate(BaseModel):
    title: str
    description: str
    required_skills: Optional[List[str]] = None
    status: JobStatus = JobStatus.draft


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None
    status: Optional[JobStatus] = None


def _job_out(job: Job) -> dict:
    return {
        "id": str(job.id),
        "recruiter_id": str(job.recruiter_id),
        "title": job.title,
        "description": job.description,
        "required_skills": job.required_skills or [],
        "status": job.status,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


# ── Public ────────────────────────────────────────────────────────────────

@router.get("")
def list_jobs(session: Session = Depends(get_session)):
    jobs = session.exec(select(Job).where(Job.status == JobStatus.open)).all()
    return [_job_out(j) for j in jobs]


@router.get("/{job_id}")
def get_job(job_id: str, session: Session = Depends(get_session)):
    job = session.get(Job, uuid.UUID(job_id))
    if not job:
        raise HTTPException(404, "Job not found")
    return _job_out(job)


# ── Recruiter / Admin ─────────────────────────────────────────────────────

@router.get("/mine/list")
def list_my_jobs(
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """All of the requesting recruiter's jobs, any status (for job management)."""
    jobs = session.exec(select(Job).where(Job.recruiter_id == recruiter.id)).all()
    jobs = sorted(jobs, key=lambda j: j.created_at, reverse=True)
    return [_job_out(j) for j in jobs]


@router.post("", status_code=201)
def create_job(
    body: JobCreate,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    job = Job(recruiter_id=recruiter.id, **body.model_dump())
    session.add(job)
    session.commit()
    session.refresh(job)
    return _job_out(job)


@router.put("/{job_id}")
def update_job(
    job_id: str,
    body: JobUpdate,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    job = session.get(Job, uuid.UUID(job_id))
    if not job:
        raise HTTPException(404, "Job not found")
    if job.recruiter_id != recruiter.id and recruiter.role != UserRole.admin:
        raise HTTPException(403, "Not your job")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(job, field, value)
    job.updated_at = datetime.utcnow()
    session.add(job)
    session.commit()
    session.refresh(job)
    return _job_out(job)


@router.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    job = session.get(Job, uuid.UUID(job_id))
    if not job:
        raise HTTPException(404, "Job not found")
    if job.recruiter_id != recruiter.id and recruiter.role != UserRole.admin:
        raise HTTPException(403, "Not your job")
    session.delete(job)
    session.commit()
