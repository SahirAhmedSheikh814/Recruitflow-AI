"""Reply Intent Agent (Module 11).

Reads an inbound candidate email (a reply to an interview invitation) and
classifies what the candidate wants, so the system can react. Single-purpose per
the "one Agent per task" rule.

Tools:
  * ``classify_reply_intent(intent)`` — records one of ``confirm``,
    ``needs_reschedule``, ``decline_permanently`` and stores the raw reply on the
    interview's ``last_candidate_reply``.
  * ``write_explanation_note(note)`` — records a short human-readable note (used
    as the ``cancellation_reason`` when the candidate declines/reschedules).

After classification the runner (:mod:`app.agents.runner`) drives the concrete
follow-through — cancelling/rescheduling via the Scheduling Agent and sending a
confirmation via the Email Agent — which is more reliable on free-tier models
than asking one LLM to chain multiple handoffs, while keeping each task agentic.

The application id comes from the trusted context, never the model.
"""
from __future__ import annotations

import logging

from agents import Agent, RunContextWrapper, function_tool
from sqlmodel import Session, select

from app.agents.context import AgentRunContext
from app.agents.llm_config import get_agent_model
from app.db.session import engine
from app.models.interview import Interview

logger = logging.getLogger("recruitflow.agents.reply_intent")

VALID_INTENTS = {"confirm", "needs_reschedule", "decline_permanently"}


PROMPT = """\
You are the Reply Intent Agent for RecruitFlow AI, an AI recruitment system.

You are given the plain text of a candidate's email reply to an interview
invitation. Decide what they want and do this:
1. Call `classify_reply_intent` with exactly one intent:
   - "confirm" — they accept / confirm the proposed time.
   - "needs_reschedule" — they can't make it and want a different time.
   - "decline_permanently" — they withdraw / decline the interview or role.
2. If the intent is needs_reschedule or decline_permanently, also call
   `write_explanation_note` with a one-sentence summary of their reason.
Then stop. Do not write prose back to the user. When unsure between confirm and
reschedule, prefer needs_reschedule.
"""


@function_tool(strict_mode=False)
def classify_reply_intent(ctx: RunContextWrapper[AgentRunContext], intent: str) -> str:
    """Record the classified intent and stash the raw reply on the interview.

    Args:
        intent: One of confirm, needs_reschedule, decline_permanently.
    """
    intent = (intent or "").strip()
    if intent not in VALID_INTENTS:
        return f"Error: intent must be one of {sorted(VALID_INTENTS)}."
    ctx.context.reply_intent = intent

    # Persist the raw reply text (staged on the context by the runner) so the
    # recruiter can read exactly what the candidate said.
    raw = getattr(ctx.context, "reply_text", None)
    with Session(engine) as session:
        interview = session.exec(
            select(Interview).where(Interview.application_id == ctx.context.application_id)
        ).first()
        if interview is not None and raw:
            interview.last_candidate_reply = raw[:2000]
            session.add(interview)
            session.commit()
    logger.info("reply intent for %s: %s", ctx.context.application_id, intent)
    return f"Intent recorded: {intent}."


@function_tool(strict_mode=False)
def write_explanation_note(ctx: RunContextWrapper[AgentRunContext], note: str) -> str:
    """Record a short explanation note for the recruiter (reschedule/decline reason).

    Args:
        note: One-sentence summary of the candidate's reason.
    """
    ctx.context.reply_explanation = (note or "").strip()[:500]
    return "Explanation note recorded."


def build_reply_intent_agent() -> Agent[AgentRunContext]:
    """Construct the Reply Intent Agent."""
    return Agent[AgentRunContext](
        name="Reply Intent Agent",
        instructions=PROMPT,
        model=get_agent_model(),
        tools=[classify_reply_intent, write_explanation_note],
    )
