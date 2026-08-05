import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class InterviewStatus(str, Enum):
    proposed = "proposed"
    confirmed = "confirmed"
    rescheduled = "rescheduled"
    cancelled = "cancelled"
    completed = "completed"

class Interview(SQLModel, table=True):
    __tablename__ = "interviews"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id")
    google_event_id: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    status: InterviewStatus = InterviewStatus.proposed
    cancellation_reason: Optional[str] = None
    last_candidate_reply: Optional[str] = None
