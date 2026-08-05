import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class UserRole(str, Enum):
    admin = "admin"
    recruiter = "recruiter"
    candidate = "candidate"

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    role: UserRole
    email: str = Field(unique=True)
    password_hash: Optional[str] = None
    google_id: Optional[str] = None
    full_name: str
    picture_url: Optional[str] = None
    gender: Optional[str] = None
    created_by_admin_id: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
