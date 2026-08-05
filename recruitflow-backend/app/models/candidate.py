import uuid
from typing import Optional, Dict
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from enum import Enum

class SourceChannel(str, Enum):
    website = "website"
    email = "email"
    google_form = "google_form"
    linkedin = "linkedin"

class Candidate(SQLModel, table=True):
    __tablename__ = "candidates"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    full_name: str
    email: str
    phone: Optional[str] = None
    current_location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    resume_file_url: Optional[str] = None
    source_channel: SourceChannel
    parsed_data: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
