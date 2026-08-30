"""Synchronous per-turn runner for Riva (the candidate-facing agent).

Unlike the recruiter-facing pipeline in ``runner.py`` (fire-and-forget background
threads), Riva runs one turn *inline* on the request path and returns the reply to
the candidate. This module deliberately imports NOTHING from ``runner.py`` or any
of the six recruiter-facing agents — importing ``runner`` would transitively pull
in the Orchestrator and its handoffs, breaking the strict candidate/recruiter
separation. It therefore writes its own small ``agent_runs`` audit row.

The runner never creates an application. It runs Riva over the recent chat
history, lets her tools update the conversation draft, and reports back whether
this turn marked the draft ready to submit — the submission itself is performed by
the browser against the existing ``POST /applications`` endpoint.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional

from agents import Runner
from sqlmodel import Session, select

from app.agents.riva_agent import build_riva_agent
from app.agents.riva_context import RivaContext
from app.db.session import engine
from app.models.agent_run import AgentRun, AgentRunStatus
from app.models.candidate import Candidate

logger = logging.getLogger("recruitflow.agents.riva_runner")

# Riva may call several read tools then a draft/confirm tool in one turn, so allow
# a few more turns than the pipeline agents.
_MAX_TURNS = 12

# Only the most recent messages are fed back as context, to bound token use and
# latency on a long-running conversation.
_HISTORY_WINDOW = 20

_FALLBACK_REPLY = (
    "Sorry — I hit a snag on my end. Could you say that again in a moment?"
)


@dataclass
class RivaTurnResult:
    assistant_text: str
    ready_to_submit: bool


def _log_riva_run(
    *,
    input_summary: str,
    output_summary: str,
    status: AgentRunStatus,
) -> None:
    """Write one ``agent_runs`` row for a Riva turn (best-effort — never raises).

    Local to this module by design: importing the shared ``_log_agent_run`` from
    ``runner.py`` would drag in the six recruiter-facing agents. ``application_id``
    is left null because a chat turn is not tied to one application.
    """
    try:
        with Session(engine) as session:
            session.add(
                AgentRun(
                    agent_name="Riva",
                    application_id=None,
                    input_summary=input_summary[:1000],
                    output_summary=output_summary[:1000],
                    handed_off_to=None,
                    status=status,
                )
            )
            session.commit()
    except Exception:  # noqa: BLE001 — auditing must never break a chat reply
        logger.exception("failed to write agent_runs row for Riva turn")


def _resolve_candidate_id(user_id: uuid.UUID, email: str) -> Optional[uuid.UUID]:
    with Session(engine) as session:
        candidate = session.exec(
            select(Candidate).where(Candidate.user_id == user_id)
        ).first()
        if candidate is None and email:
            candidate = session.exec(
                select(Candidate).where(Candidate.email == email.lower())
            ).first()
        return candidate.id if candidate else None


async def run_riva_turn(
    *,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    email: str,
    full_name: str,
    history: List[Dict[str, str]],
) -> RivaTurnResult:
    """Run one Riva turn over the recent history and return her reply.

    ``history`` is the ordered transcript (oldest first) as ``{"role", "content"}``
    items, including the just-received user message as the final item. Never
    raises: an agent/LLM failure is logged and returned as a friendly fallback so
    the chat stays responsive.
    """
    windowed = history[-_HISTORY_WINDOW:]
    context = RivaContext(
        user_id=user_id,
        conversation_id=conversation_id,
        email=email,
        full_name=full_name,
        candidate_id=_resolve_candidate_id(user_id, email),
    )

    last_user = next(
        (m["content"] for m in reversed(windowed) if m.get("role") == "user"), ""
    )

    try:
        result = await Runner.run(
            build_riva_agent(),
            windowed,
            context=context,
            max_turns=_MAX_TURNS,
        )
        assistant_text = (result.final_output or "").strip() if result else ""
        if not assistant_text:
            assistant_text = (
                "I'm here to help — could you tell me a bit more about what you'd "
                "like to do?"
            )
        _log_riva_run(
            input_summary=f"user: {last_user[:400]}",
            output_summary=(
                f"tools={context.tools_used} ready={context.ready_to_submit} "
                f"reply: {assistant_text[:300]}"
            ),
            status=AgentRunStatus.success,
        )
        return RivaTurnResult(
            assistant_text=assistant_text,
            ready_to_submit=context.ready_to_submit,
        )
    except Exception as exc:  # noqa: BLE001 — a chat turn must degrade gracefully
        logger.exception("Riva turn failed for conversation %s", conversation_id)
        _log_riva_run(
            input_summary=f"user: {last_user[:400]}",
            output_summary=f"riva_error: {exc}",
            status=AgentRunStatus.failed,
        )
        return RivaTurnResult(assistant_text=_FALLBACK_REPLY, ready_to_submit=False)
