"""Resume Parser Agent (Module 4).

Takes the plain text of a resume (extracted upstream by
:mod:`app.services.resume_extraction`) and turns it into structured data. It is
a single-purpose agent per the project's "one Agent per task" rule.

The agent has exactly two tools:

  * ``save_parsed_candidate(data_json)`` — the happy path. The model passes the
    extracted fields as a single JSON object (as a string); we validate it
    against :class:`~app.agents.schemas.ParsedResume` (Pydantic-schema-checked
    output) before persisting to ``candidates.parsed_data`` and backfilling any
    empty first-class candidate columns (phone, location, links).

    Why a JSON string and not a typed ``ParsedResume`` parameter: a nested
    Pydantic parameter makes the SDK emit a tool schema using JSON-Schema
    ``$ref``/``$defs`` (for the ``education`` / ``previous_employers`` sub-models),
    and several OpenRouter free-tier providers reject function schemas that
    contain ``$ref``. Taking one string argument keeps the tool schema flat and
    provider-agnostic while we still get full Pydantic validation inside the
    handler.
  * ``flag_low_confidence_extraction(reason)`` — the escape hatch for resumes
    that are too sparse, garbled, or non-resume to trust. The recruiter sees
    the flag instead of silently-wrong data.

Neither tool takes an ``application_id`` from the model: that lives in the
trusted :class:`~app.agents.context.AgentRunContext`, so the LLM cannot redirect
a write to a different candidate.

The status transition (→ ``parsed``), ``agent_runs`` logging, and real-time
broadcast are handled by the runner (:mod:`app.agents.runner`) after the run
completes, not inside these tools — tools stay small and idempotent.
"""
from __future__ import annotations

import json
import logging

from agents import Agent, RunContextWrapper, function_tool
from pydantic import ValidationError
from sqlmodel import Session

from app.agents.context import AgentRunContext
from app.agents.llm_config import get_agent_model
from app.agents.schemas import ParsedResume
from app.db.session import engine
from app.models.candidate import Candidate
from app.models.application import Application

logger = logging.getLogger("recruitflow.agents.resume_parser")


PROMPT = """\
You are the Resume Parser Agent for RecruitFlow AI, an AI recruitment system.

You are given the raw plain text of a single candidate's resume. Your job is to
extract accurate, structured information from it and save it by calling the
`save_parsed_candidate` tool exactly once.

Pass everything as the `data_json` argument: a SINGLE JSON object (encoded as a
string) with these keys (omit any you genuinely cannot find — never invent data):
- full_name (string), email (string), phone (string)
- current_location (string: city / region / country)
- linkedin_url (string), portfolio_url (string; GitHub / personal site counts)
- summary (string: professional summary or objective, if present)
- skills (array of strings; technical and professional; deduplicate; concise)
- certifications (array of strings; certifications / licenses)
- education (array of objects, each with: institution, degree, field_of_study,
  start_year, end_year — all strings)
- previous_employers (array of objects, each with: company, title, start_date,
  end_date, description — all strings; most recent first)
- years_of_experience (number: estimate TOTAL years of professional experience
  from the work history, e.g. 4.5)

Example data_json:
{"full_name":"Jane Smith","email":"jane@example.com","skills":["Python","AWS"],
"education":[{"institution":"University of Sydney","degree":"BSc Computer Science"}],
"previous_employers":[{"company":"Atlassian","title":"Senior Engineer"}],
"years_of_experience":7}

Rules:
- Extract only what the resume actually states. Do NOT guess or fabricate.
  If a field is absent, omit its key rather than filling a placeholder.
- Normalise obvious formatting (trim whitespace, fix casing on names) but keep
  dates roughly as written.
- If the text is clearly not a resume, is empty/garbled, or is so sparse that
  you cannot extract a name AND at least one of {email, skills, employment},
  call `flag_low_confidence_extraction` with a short reason INSTEAD of
  `save_parsed_candidate`.
- Call exactly one tool, then stop. Do not write prose back to the user.
"""


@function_tool(strict_mode=False)
def save_parsed_candidate(
    ctx: RunContextWrapper[AgentRunContext], data_json: str
) -> str:
    """Persist the structured resume data for the current application.

    Args:
        data_json: A JSON object (as a string) holding the fields extracted from
            the resume: full_name, email, phone, current_location, linkedin_url,
            portfolio_url, summary, skills[], certifications[], education[],
            previous_employers[], years_of_experience.
    """
    application_id = ctx.context.application_id

    # Validate the model-supplied JSON against the ParsedResume Pydantic schema.
    # This is the "Pydantic-schema-checked output" the spec requires; we just do
    # it here (rather than via a typed tool param) to keep the tool schema flat.
    try:
        payload = json.loads(data_json)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("save_parsed_candidate got invalid JSON: %s", exc)
        return (
            "Error: data_json was not valid JSON. Send a single JSON object "
            "with the extracted fields."
        )

    if not isinstance(payload, dict):
        return "Error: data_json must be a JSON object, not a list or scalar."

    try:
        data = ParsedResume.model_validate(payload)
    except ValidationError as exc:
        logger.warning("save_parsed_candidate schema validation failed: %s", exc)
        return (
            "Error: the data did not match the required schema. "
            f"Fix these and retry: {exc.errors()[:5]}"
        )

    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            return f"Error: application {application_id} not found."

        candidate = session.get(Candidate, application.candidate_id)
        if candidate is None:
            return f"Error: candidate for application {application_id} not found."

        # Store the full structured extraction as JSON on the candidate row.
        candidate.parsed_data = data.model_dump(mode="json")

        # Backfill first-class candidate columns only when they're empty, so we
        # enrich the record without clobbering data a channel already supplied.
        if not candidate.phone and data.phone:
            candidate.phone = data.phone
        if not candidate.current_location and data.current_location:
            candidate.current_location = data.current_location
        if not candidate.linkedin_url and data.linkedin_url:
            candidate.linkedin_url = data.linkedin_url
        if not candidate.portfolio_url and data.portfolio_url:
            candidate.portfolio_url = data.portfolio_url
        # Only overwrite a placeholder name (intake defaults to the email local
        # part when no name is known); never overwrite a real supplied name.
        if data.full_name and (
            not candidate.full_name
            or candidate.full_name == candidate.email.split("@")[0]
        ):
            candidate.full_name = data.full_name

        session.add(candidate)
        session.commit()

    ctx.context.parsed_ok = True
    logger.info("saved parsed data for application %s", application_id)
    return "Parsed resume data saved successfully."


@function_tool(strict_mode=False)
def flag_low_confidence_extraction(
    ctx: RunContextWrapper[AgentRunContext], reason: str
) -> str:
    """Flag that the resume could not be parsed with confidence.

    Args:
        reason: A short human-readable explanation of why extraction is
            low-confidence (e.g. "scanned image with no text", "not a resume",
            "too sparse to extract a name").
    """
    ctx.context.low_confidence = True
    ctx.context.low_confidence_reason = reason
    logger.warning(
        "low-confidence extraction for application %s: %s",
        ctx.context.application_id,
        reason,
    )
    return "Low-confidence extraction flagged for recruiter review."


def build_resume_parser_agent() -> Agent[AgentRunContext]:
    """Construct the Resume Parser Agent (configures the LLM provider first)."""
    return Agent[AgentRunContext](
        name="Resume Parser Agent",
        instructions=PROMPT,
        model=get_agent_model(),
        tools=[save_parsed_candidate, flag_low_confidence_extraction],
    )
