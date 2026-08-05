"""Email Agent (Module 10).

Owns every transactional email in the system. It selects the right branded
template, renders it with the candidate/job details, sends it, and records the
send in ``email_logs``. Single-purpose per the "one Agent per task" rule.

Tools (per the Module 10 spec):
  * ``render_email_template(email_type)`` — renders one of the six branded
    templates (confirmation, shortlisted, interview_invite, reminder, offer,
    rejection) using this application's real candidate + job data, and stages
    the result on the run context.
  * ``send_email()`` — sends the staged email to the candidate.
  * ``log_email(status)`` — writes the ``email_logs`` audit row.

The application id comes from the trusted context, never the model, so the LLM
can never send to a different candidate. Sending is dormant until SMTP creds
exist (see :mod:`app.services.email_service`); the log row still records intent.
"""
from __future__ import annotations

import logging

from agents import Agent, RunContextWrapper, function_tool
from sqlmodel import Session, select

from app.agents.context import AgentRunContext
from app.agents.llm_config import get_agent_model
from app.db.session import engine
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.email_log import EmailLog, EmailStatus, EmailType
from app.models.job import Job
from app.services import email_service

logger = logging.getLogger("recruitflow.agents.email")

VALID_TYPES = {t.value for t in EmailType}


PROMPT = """\
You are the Email Agent for RecruitFlow AI, an AI recruitment system.

You send ONE transactional email for the current application. You are told which
kind to send. Do it in this exact order:
1. Call `render_email_template` with the correct email_type. Valid types:
   confirmation, shortlisted, interview_invite, reminder, offer, rejection.
2. Call `send_email` (no arguments) to send the rendered email.
3. Call `log_email` with the resulting status ("sent" or "failed").

Then stop. Do not write prose back to the user. Do not invent recipient
addresses — the candidate is resolved from the application automatically.
"""


def _load_context(application_id) -> dict:
    """Assemble template context (candidate name/email, job title) from the DB.

    For interview-related emails we also surface the scheduled interview's real
    date/time and calendar link (from the most recent ``interviews`` row) so the
    invitation reads professionally instead of saying "the scheduled time".
    """
    from app.models.interview import Interview

    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            return {}
        candidate = session.get(Candidate, application.candidate_id)
        job = session.get(Job, application.job_id)
        ctx: dict = {
            "candidate_name": candidate.full_name if candidate else None,
            "candidate_email": candidate.email if candidate else None,
            "job_title": job.title if job else None,
        }

        interview = session.exec(
            select(Interview)
            .where(Interview.application_id == application_id)
            .order_by(Interview.scheduled_start.desc())
        ).first()
        if interview is not None and interview.scheduled_start is not None:
            # e.g. "Monday, 04 August 2026 at 10:00 AM UTC"
            ctx["interview_datetime"] = interview.scheduled_start.strftime(
                "%A, %d %B %Y at %I:%M %p UTC"
            )
            if interview.google_event_id:
                ctx["interview_link"] = (
                    "https://calendar.google.com/calendar/event?eid="
                    f"{interview.google_event_id}"
                )
        return ctx


@function_tool(strict_mode=False)
def render_email_template(ctx: RunContextWrapper[AgentRunContext], email_type: str) -> str:
    """Render a branded email for the current application and stage it.

    Args:
        email_type: One of confirmation, shortlisted, interview_invite,
            reminder, offer, rejection.
    """
    email_type = (email_type or "").strip()
    if email_type not in VALID_TYPES:
        return f"Error: invalid email_type. Use one of: {sorted(VALID_TYPES)}."

    tmpl_ctx = _load_context(ctx.context.application_id)
    if not tmpl_ctx:
        return "Error: application not found."

    subject, html = email_service.render_template(email_type, tmpl_ctx)
    ctx.context.email_type = email_type
    ctx.context.email_subject = subject
    ctx.context.email_html = html
    return f"Rendered '{email_type}' email with subject: {subject}"


@function_tool(strict_mode=False)
def send_email(ctx: RunContextWrapper[AgentRunContext]) -> str:
    """Send the email previously rendered by render_email_template."""
    if not ctx.context.email_html:
        return "Error: call render_email_template first — nothing to send."
    tmpl_ctx = _load_context(ctx.context.application_id)
    to = tmpl_ctx.get("candidate_email")
    if not to:
        return "Error: candidate has no email address."
    ok = email_service.send_email(to, ctx.context.email_subject or "", ctx.context.email_html)
    ctx.context.email_sent = ok
    return "Email sent." if ok else "Email not sent (SMTP dormant or send failed)."


@function_tool(strict_mode=False)
def log_email(ctx: RunContextWrapper[AgentRunContext], status: str) -> str:
    """Write the email_logs audit row for this send.

    Args:
        status: "sent" or "failed".
    """
    email_type = ctx.context.email_type
    if email_type not in VALID_TYPES:
        return "Error: no email has been rendered to log."
    try:
        log_status = EmailStatus(status) if status in {s.value for s in EmailStatus} else (
            EmailStatus.sent if ctx.context.email_sent else EmailStatus.failed
        )
    except ValueError:
        log_status = EmailStatus.sent if ctx.context.email_sent else EmailStatus.failed

    with Session(engine) as session:
        session.add(
            EmailLog(
                application_id=ctx.context.application_id,
                type=EmailType(email_type),
                status=log_status,
            )
        )
        session.commit()
    logger.info("logged %s email (%s) for %s", email_type, log_status, ctx.context.application_id)
    return f"Logged {email_type} email as {log_status.value}."


def build_email_agent() -> Agent[AgentRunContext]:
    """Construct the Email Agent."""
    return Agent[AgentRunContext](
        name="Email Agent",
        instructions=PROMPT,
        model=get_agent_model(),
        tools=[render_email_template, send_email, log_email],
    )
