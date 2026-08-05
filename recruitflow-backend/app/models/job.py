import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from enum import Enum

class JobStatus(str, Enum):
    open = "open"
    closed = "closed"
    draft = "draft"

class Job(SQLModel, table=True):
    __tablename__ = "jobs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recruiter_id: uuid.UUID = Field(foreign_key="users.id")
    title: str
    description: str
    required_skills: Optional[List] = Field(default=None, sa_column=Column(JSON))
    status: JobStatus = JobStatus.draft
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
