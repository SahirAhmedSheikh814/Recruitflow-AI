"""Recruiter profile & settings (Module 6).

Backs the recruiter Settings page: company name, working hours (used by the
Scheduling Agent's free/busy window), and Google Calendar connection status.
The calendar OAuth round-trip itself lives in the interviews router.
"""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.deps import require_role
from app.db.session import get_session
from app.models.recruiter_profile import RecruiterProfile
from app.models.user import User, UserRole

router = APIRouter()


class ProfileUpdate(BaseModel):
    company_name: str | None = None
    working_hours_start: str | None = None
    working_hours_end: str | None = None


def _get_or_create(session: Session, user_id: uuid.UUID) -> RecruiterProfile:
    profile = session.exec(
        select(RecruiterProfile).where(RecruiterProfile.user_id == user_id)
    ).first()
    if profile is None:
        profile = RecruiterProfile(user_id=user_id)
        session.add(profile)
        session.commit()
        session.refresh(profile)
    return profile


def _out(profile: RecruiterProfile) -> dict:
    return {
        "id": str(profile.id),
        "company_name": profile.company_name,
        "working_hours_start": profile.working_hours_start,
        "working_hours_end": profile.working_hours_end,
        "google_calendar_connected": profile.google_calendar_connected,
    }


@router.get("/profile")
def get_profile(
    recruiter: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    return _out(_get_or_create(session, recruiter.id))


@router.put("/profile")
def update_profile(
    body: ProfileUpdate,
    recruiter: User = Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    profile = _get_or_create(session, recruiter.id)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return _out(profile)
