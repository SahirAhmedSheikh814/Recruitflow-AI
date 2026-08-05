import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class ApplicationStatus(str, Enum):
    received = "received"
    parsed = "parsed"
    scored = "scored"
    shortlisted = "shortlisted"
    rejected = "rejected"
    interview_scheduled = "interview_scheduled"
    interview_completed = "interview_completed"
    offer = "offer"
    hired = "hired"

class Application(SQLModel, table=True):
    __tablename__ = "applications"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    candidate_id: uuid.UUID = Field(foreign_key="candidates.id")
    job_id: uuid.UUID = Field(foreign_key="jobs.id")
    score: Optional[int] = None
    classification: Optional[str] = None
    score_explanation: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.received
    recruiter_decision_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
