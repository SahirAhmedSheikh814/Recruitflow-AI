"""Orchestrator Agent — the single entry point for the agentic layer.

Per the project's architecture, nothing outside ``app/agents`` talks to a
specialist agent directly. Intake (and later, the reply-handling worker) hands
work to the Orchestrator, which *routes* it to the right specialist via the
Agents SDK ``handoff()`` mechanism. Keeping one front door means routing logic
lives in exactly one place as more agents come online.

Module 4 wires up a single downstream route: raw resume text → **Resume Parser
Agent**. The Scoring, Scheduling, Email, and Reply-Intent handoffs get added to
``downstream`` in their own modules (5, 9, 10, 11) — the Orchestrator itself
won't need to change, only its list of available handoffs.

The Orchestrator has no tools of its own: it reads the incoming payload, picks
a specialist, and hands off. All persistence happens inside the specialist's
tools; all status/logging/broadcast happens in the runner after the run ends.
"""
from __future__ import annotations

from agents import Agent, handoff

from app.agents.context import AgentRunContext
from app.agents.llm_config import get_agent_model
from app.agents.resume_parser_agent import build_resume_parser_agent


PROMPT = """\
You are the Orchestrator Agent for RecruitFlow AI, an AI recruitment system.

You are the entry point for all agent work. You do NOT do the work yourself —
you decide which specialist agent should handle the incoming request and hand
off to it. Do not write prose back to the user; always route via a handoff.

Routing rules:
- If you are given the raw plain text of a candidate's resume to extract and
  save structured data from, hand off to the "Resume Parser Agent".

Hand off to exactly one specialist, then stop.
"""


def build_orchestrator_agent() -> Agent[AgentRunContext]:
    """Construct the Orchestrator Agent wired to its downstream specialists."""
    # Each specialist the Orchestrator can route to. New agents (Scoring,
    # Scheduling, Email, Reply Intent) append their handoffs here as they land.
    downstream = [
        handoff(build_resume_parser_agent()),
    ]

    return Agent[AgentRunContext](
        name="Orchestrator Agent",
        instructions=PROMPT,
        model=get_agent_model(),
        handoffs=downstream,
    )
