"""Per-run context object passed to agents and their tools.

The Agents SDK threads a single user-supplied ``context`` object through a run
(``Runner.run(agent, input, context=...)``) and hands it to every tool as
``RunContextWrapper.context``. We use it to carry the two things resume-parsing
tools need but must not take from the model: which application this run is for,
and a DB session factory. Keeping ``application_id`` in the trusted context
(never a tool argument) means the LLM can't redirect a write to another
candidate's row.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class AgentRunContext:
    """Trusted, non-model-supplied state for one orchestrated agent run."""

    application_id: uuid.UUID
    # Filled in by tools as the run progresses, so the runner can write an
    # accurate ``agent_runs`` row and decide the final application status.
    parsed_ok: bool = False
    low_confidence: bool = False
    low_confidence_reason: str | None = None
    # Scoring stage (Module 5): set by the Scoring Agent's save_score tool.
    scored_ok: bool = False
    score: int | None = None
    classification: str | None = None
    # Email stage (Module 10): staged by the Email Agent's tools across its
    # render → send → log tool sequence.
    email_type: str | None = None
    email_subject: str | None = None
    email_html: str | None = None
    email_sent: bool = False
    # Scheduling stage (Module 9 / 11): set by the Scheduling Agent's tools.
    interview_scheduled: bool = False
    interview_action: str | None = None  # booked / rescheduled / cancelled
    # Reply-intent stage (Module 11): set by the Reply Intent Agent's tools.
    reply_text: str | None = None  # raw inbound candidate email (staged by runner)
    reply_intent: str | None = None  # confirm / decline_permanently / needs_reschedule
    reply_explanation: str | None = None
