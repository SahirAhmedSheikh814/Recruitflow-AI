import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field
from enum import Enum

class EmailType(str, Enum):
    confirmation = "confirmation"
    shortlisted = "shortlisted"
    interview_invite = "interview_invite"
    reminder = "reminder"
    offer = "offer"
    rejection = "rejection"

class EmailStatus(str, Enum):
    sent = "sent"
    failed = "failed"
    replied = "replied"

class EmailLog(SQLModel, table=True):
    __tablename__ = "email_logs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    application_id: uuid.UUID = Field(foreign_key="applications.id")
    type: EmailType
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    status: EmailStatus = EmailStatus.sent
