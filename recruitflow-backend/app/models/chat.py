"""
Chat persistence for Riva, the candidate-facing conversational agent.

Two tables, both scoped to a single candidate:

  chat_conversations — one row per candidate (Riva keeps a single rolling thread
                       per user). `draft` holds the in-progress application
                       payload Riva has collected so far; it is a plain JSON
                       blob so the shape can evolve without a migration.
  chat_messages      — the transcript, oldest first, used to rebuild context on
                       every turn and to re-render the thread after a reload.

Nothing here touches applications, candidates or the six recruiter-facing
agents. Riva never writes an application row: `draft` is scratch space, and the
actual submission goes through the existing POST /applications endpoint.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class ChatRole(str, Enum):
    user = "user"
    assistant = "assistant"


class ChatConversation(SQLModel, table=True):
    __tablename__ = "chat_conversations"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    # Application data collected so far. Keys mirror the POST /applications form
    # fields (job_id, full_name, email, phone, ...) plus `resume_attached` and
    # `ready`. Résumé bytes are never stored here — the file stays in the
    # browser until the widget posts it to the existing endpoint.
    draft: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="chat_conversations.id", index=True)
    role: ChatRole
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
