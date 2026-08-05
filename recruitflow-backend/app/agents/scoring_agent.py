"""Scoring Agent (Module 5).

Given a candidate's already-parsed resume data and the job they applied to, this
agent produces a 0–100 fit score, a classification band, and a short written
explanation, then persists them by calling ``save_score`` exactly once. Like the
Resume Parser Agent it is single-purpose ("one Agent per task").

Tools (per the Module 5 spec):
  * ``get_job_description()`` — returns the target job's title, description, and
    required skills for the current application. The application id comes from
    the trusted :class:`~app.agents.context.AgentRunContext`, never the model, so
    the LLM cannot score against a different job.
  * ``save_score(score, explanation)`` — validates the band and persists
    ``applications.score / classification / score_explanation``. The status
    transition (→ ``scored``), ``agent_runs`` logging, and the real-time
    broadcast are done by the runner after the run, keeping the tool small.

Classification bands are fixed by the spec:
    90–100 Highly Recommended · 75–89 Recommended · 60–74 Consider · <60 Not Recommended
"""
from __future__ import annotations

import json
import logging

from agents import Agent, RunContextWrapper, function_tool
from sqlmodel import Session

from app.agents.context import AgentRunContext
from app.agents.llm_config import get_agent_model
from app.db.session import engine
from app.models.application import Application
from app.models.job import Job

logger = logging.getLogger("recruitflow.agents.scoring")


def classify(score: int) -> str:
    """Map a 0–100 score to its fixed classification band.

    Derived from the number so the label can never drift from the score,
    whatever the model claims.
    """
    if score >= 90:
        return "Highly Recommended"
    if score >= 75:
        return "Recommended"
    if score >= 60:
        return "Consider"
    return "Not Recommended"


PROMPT = """\
You are the Scoring Agent for RecruitFlow AI, an AI recruitment system.

You evaluate ONE candidate against ONE job and produce a fit score. Follow these
steps exactly:
1. Call `get_job_description` (no arguments) to fetch the job title, description,
   and required skills for this application.
2. Compare the candidate's parsed resume data (given to you as the input) against
   the job. Weigh, in rough order of importance:
   - required/technical skills match
   - years and depth of relevant technical experience
   - industry experience
   - certifications and education
   - language and location fit (if the job states any)
3. Call `save_score` exactly once with:
   - score: an integer 0–100 (higher = better fit)
   - explanation: 2–4 sentences citing concrete evidence from the resume and job
     (name matched skills, gaps, experience level). Be specific and fair.
   You do NOT pass a classification — it is derived from the score.

Rules:
- Base the score only on evidence. Missing required skills should lower it;
  strong direct matches should raise it. Do not inflate.
- Call `get_job_description` first, then `save_score` once, then stop. Do not
  write prose back to the user.
"""


@function_tool(strict_mode=False)
def get_job_description(ctx: RunContextWrapper[AgentRunContext]) -> str:
    """Return the target job's title, description, and required skills as JSON."""
    application_id = ctx.context.application_id
    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            return json.dumps({"error": f"application {application_id} not found"})
        job = session.get(Job, application.job_id)
        if job is None:
            return json.dumps({"error": "job not found for this application"})
        return json.dumps(
            {
                "title": job.title,
                "description": job.description,
                "required_skills": job.required_skills or [],
            }
        )


@function_tool(strict_mode=False)
def save_score(
    ctx: RunContextWrapper[AgentRunContext],
    score: int,
    explanation: str,
) -> str:
    """Persist the candidate's fit score for the current application.

    Args:
        score: Integer 0–100 fit score (higher is a better fit).
        explanation: 2–4 sentence justification citing concrete evidence.
    """
    application_id = ctx.context.application_id

    try:
        score_int = int(score)
    except (TypeError, ValueError):
        return "Error: score must be an integer between 0 and 100."
    score_int = max(0, min(100, score_int))
    classification = classify(score_int)

    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            return f"Error: application {application_id} not found."
        application.score = score_int
        application.classification = classification
        application.score_explanation = (explanation or "").strip()[:2000]
        session.add(application)
        session.commit()

    ctx.context.scored_ok = True
    ctx.context.score = score_int
    ctx.context.classification = classification
    logger.info(
        "scored application %s: %s (%s)", application_id, score_int, classification
    )
    return f"Score {score_int} ({classification}) saved."


def build_scoring_agent() -> Agent[AgentRunContext]:
    """Construct the Scoring Agent."""
    return Agent[AgentRunContext](
        name="Scoring Agent",
        instructions=PROMPT,
        model=get_agent_model(),
        tools=[get_job_description, save_score],
    )
