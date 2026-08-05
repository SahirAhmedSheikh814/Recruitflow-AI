"""Agentic AI layer for RecruitFlow AI (OpenAI Agents SDK).

One file per agent per the project's "one Agent per task" rule. The
Orchestrator Agent is the single entry point; specialists (Resume Parser, and
later Scoring/Scheduling/Email/Reply-Intent) are reached only via its handoffs.

Public surface:
  * ``build_orchestrator_agent`` / ``build_resume_parser_agent`` — agent factories.
  * ``run_resume_pipeline`` / ``run_resume_pipeline_bg`` — the runner entry points
    intake and workers use to process a resume off the request path.
  * ``AgentRunContext`` — the trusted per-run context carrying ``application_id``.

These are lazy re-exports: importing ``app.agents`` for the context type alone
must not drag in the whole LLM stack, so heavier factories are resolved on first
attribute access via ``__getattr__``.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.agents.context import AgentRunContext

__all__ = [
    "AgentRunContext",
    "build_orchestrator_agent",
    "build_resume_parser_agent",
    "run_resume_pipeline",
    "run_resume_pipeline_bg",
]

if TYPE_CHECKING:  # pragma: no cover — import hints for type checkers only
    from app.agents.orchestrator_agent import build_orchestrator_agent
    from app.agents.resume_parser_agent import build_resume_parser_agent
    from app.agents.runner import run_resume_pipeline, run_resume_pipeline_bg


def __getattr__(name: str):
    """Lazily resolve the heavier factories only when first accessed."""
    if name == "build_orchestrator_agent":
        from app.agents.orchestrator_agent import build_orchestrator_agent

        return build_orchestrator_agent
    if name == "build_resume_parser_agent":
        from app.agents.resume_parser_agent import build_resume_parser_agent

        return build_resume_parser_agent
    if name in ("run_resume_pipeline", "run_resume_pipeline_bg"):
        from app.agents import runner

        return getattr(runner, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
