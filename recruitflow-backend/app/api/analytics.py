"""Analytics & reporting (Module 14).

Aggregate KPIs for the recruiter and admin dashboards:
  * ``GET /analytics/summary``       — recruiter-scoped (their own jobs only).
  * ``GET /analytics/admin/summary`` — global, admin only.

Metrics: total applications, candidates shortlisted, interview-pipeline count,
recruitment progress %, average score, active job openings, and time-to-hire.
Computed on demand with plain aggregate queries — cheap at this scale and always
consistent with the live ATS tables.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.deps import require_role
from app.db.session import get_session
from app.models.application import Application, ApplicationStatus
from app.models.job import Job, JobStatus
from app.models.user import UserRole

router = APIRouter()

# Statuses that represent an active interview pipeline.
_INTERVIEW_STATUSES = {
    ApplicationStatus.interview_scheduled,
    ApplicationStatus.interview_completed,
}
# Terminal "resolved" statuses used for recruitment-progress %.
_RESOLVED_STATUSES = {
    ApplicationStatus.rejected,
    ApplicationStatus.hired,
    ApplicationStatus.offer,
}


def _summary(session: Session, recruiter_id: Optional[uuid.UUID]) -> dict:
    """Compute the KPI bundle, optionally scoped to one recruiter's jobs."""
    app_query = select(Application)
    job_query = select(Job)
    if recruiter_id is not None:
        job_ids = [
            j.id
            for j in session.exec(select(Job).where(Job.recruiter_id == recruiter_id)).all()
        ]
        app_query = app_query.where(Application.job_id.in_(job_ids or [uuid.uuid4()]))
        job_query = job_query.where(Job.recruiter_id == recruiter_id)

    applications = session.exec(app_query).all()
    jobs = session.exec(job_query).all()

    total = len(applications)
    shortlisted = sum(1 for a in applications if a.status == ApplicationStatus.shortlisted)
    interview_pipeline = sum(1 for a in applications if a.status in _INTERVIEW_STATUSES)
    hired = sum(1 for a in applications if a.status == ApplicationStatus.hired)
    resolved = sum(1 for a in applications if a.status in _RESOLVED_STATUSES)

    scored = [a.score for a in applications if a.score is not None]
    average_score = round(sum(scored) / len(scored), 1) if scored else None
    progress_pct = round(resolved / total * 100, 1) if total else 0.0
    active_openings = sum(1 for j in jobs if j.status == JobStatus.open)

    # Time-to-hire: avg days from application creation to a completed interview
    # for hired candidates (proxy — no explicit hire timestamp column).
    hire_days: list[float] = []
    for a in applications:
        if a.status != ApplicationStatus.hired:
            continue
        delta = (a.updated_at - a.created_at).total_seconds() / 86400
        if delta >= 0:
            hire_days.append(delta)
    time_to_hire_days = round(sum(hire_days) / len(hire_days), 1) if hire_days else None

    # Status distribution for funnel/bar charts.
    by_status = {status.value: 0 for status in ApplicationStatus}
    for a in applications:
        key = a.status.value if hasattr(a.status, "value") else str(a.status)
        by_status[key] = by_status.get(key, 0) + 1

    return {
        "total_applications": total,
        "candidates_shortlisted": shortlisted,
        "interview_pipeline": interview_pipeline,
        "candidates_hired": hired,
        "recruitment_progress_pct": progress_pct,
        "average_score": average_score,
        "active_job_openings": active_openings,
        "time_to_hire_days": time_to_hire_days,
        "by_status": by_status,
    }


@router.get("/summary")
def recruiter_summary(
    recruiter=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """KPI summary scoped to the requesting recruiter's own jobs."""
    return _summary(session, recruiter.id)


@router.get("/admin/summary")
def admin_summary(
    admin=Depends(require_role(UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Global, unfiltered KPI summary across all recruiters."""
    return _summary(session, None)
