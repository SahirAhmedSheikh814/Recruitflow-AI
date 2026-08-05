import uuid
from typing import Optional
from sqlmodel import SQLModel, Field

class RecruiterProfile(SQLModel, table=True):
    __tablename__ = "recruiter_profiles"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id")
    company_name: Optional[str] = None
    working_hours_start: str = "09:00"
    working_hours_end: str = "17:00"
    google_calendar_connected: bool = False
    google_refresh_token: Optional[str] = None
