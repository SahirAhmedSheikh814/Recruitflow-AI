import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class AgentRunStatus(str, Enum):
    success = "success"
    failed = "failed"

class AgentRun(SQLModel, table=True):
    __tablename__ = "agent_runs"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_name: str
    application_id: Optional[uuid.UUID] = Field(default=None, foreign_key="applications.id")
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None
    handed_off_to: Optional[str] = None
    status: AgentRunStatus = AgentRunStatus.success
    created_at: datetime = Field(default_factory=datetime.utcnow)
