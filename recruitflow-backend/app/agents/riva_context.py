"""Per-turn context for Riva, the candidate-facing conversational agent.

Mirrors :class:`app.agents.context.AgentRunContext` in spirit: the Agents SDK
threads one ``context`` object through a run and hands it to every tool as
``RunContextWrapper.context``. Riva's tools take the candidate's identity from
here — never from the model — so a jailbroken prompt cannot act as another user.

Riva has NO tool that creates an application. ``ready_to_submit`` is the strongest
thing any tool sets: it only signals that the collected draft is complete, so the
widget can call the existing ``POST /applications`` endpoint with the candidate's
own cookie. The draft itself lives in the DB (``chat_conversations.draft``); this
object just carries the trusted ids and per-turn flags.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class RivaContext:
    """Trusted, non-model-supplied state for one Riva chat turn."""

    user_id: uuid.UUID
    conversation_id: uuid.UUID
    # Identity of the signed-in candidate, from the auth cookie (not the model).
    email: str
    full_name: str
    candidate_id: Optional[uuid.UUID] = None
    # Whether this turn signalled the draft is complete and ready to hand to the
    # existing POST /applications endpoint. Set only by mark_ready_to_submit.
    ready_to_submit: bool = False
    # Names of tools invoked this turn, for the agent_runs audit summary.
    tools_used: List[str] = field(default_factory=list)
