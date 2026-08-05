"""Background runner for the agentic pipeline (Module 4).

Intake never runs agents inline — it calls :func:`run_resume_pipeline` which
does the slow work off the request path. This module is the *only* place that,
around a single agent run:

  1. downloads the resume file and extracts its text (deterministic, non-AI),
  2. builds the trusted :class:`AgentRunContext` (carrying ``application_id``),
  3. runs the Orchestrator Agent → Resume Parser Agent handoff,
  4. transitions ``applications.status`` to ``parsed`` (only on success),
  5. writes an ``agent_runs`` row for the run (success or failure), and
  6. publishes an ``APPLICATION_UPDATED`` real-time event.

Steps 4–6 live here rather than inside the agent's tools so the tools stay
small and idempotent, and so a low-confidence flag or an extraction failure
still produces an accurate ``agent_runs`` audit row and a dashboard broadcast.

``run_resume_pipeline_bg`` is the fire-and-forget entry point intake calls: it
runs the async pipeline on a dedicated event loop in a daemon thread, so it
works whether or not the caller is itself inside an event loop, and never
blocks the HTTP response.
"""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import uuid

from agents import Runner
from sqlmodel import Session

from app.agents.context import AgentRunContext
from app.agents.orchestrator_agent import build_orchestrator_agent
from app.db.session import engine
from app.models.agent_run import AgentRun, AgentRunStatus
from app.models.application import Application, ApplicationStatus
from app.models.candidate import Candidate
from app.services import events, storage_service
from app.services.resume_extraction import ResumeExtractionError, extract_text

logger = logging.getLogger("recruitflow.agents.runner")

# Cap agent turns: Orchestrator handoff + one parser tool call needs only a few.
_MAX_TURNS = 8

# How many times to re-run an agent that finished a turn WITHOUT emitting its
# required tool call. Cheap/free LLMs occasionally end without calling the tool
# the pipeline depends on (which silently stalled parse or score); retrying a
# couple of times makes every agent stage reliably complete. This changes no
# downstream logic — it only re-attempts the same run until the tool fires.
_MAX_AGENT_ATTEMPTS = 3


async def _run_agent_with_retry(
    agent_factory,
    agent_input: str,
    context: AgentRunContext,
    *,
    success,
    label: str,
) -> tuple[Exception | None, str]:
    """Run an agent, retrying until it completes its required action.

    ``success`` is a predicate over the (mutated) ``context`` that returns True
    once the agent has done its job (e.g. ``parsed_ok`` / ``scored_ok`` set).
    Returns ``(error, final_output)``: ``error`` is None on success or the last
    exception if every attempt raised; ``final_output`` is the last run's text.
    """
    last_exc: Exception | None = None
    final_output = ""
    for attempt in range(1, _MAX_AGENT_ATTEMPTS + 1):
        try:
            result = await Runner.run(
                agent_factory(), agent_input, context=context, max_turns=_MAX_TURNS
            )
            final_output = (result.final_output or "").strip() if result else ""
            last_exc = None
            if success():
                return None, final_output
            logger.warning(
                "%s attempt %s/%s finished without completing its action; retrying",
                label, attempt, _MAX_AGENT_ATTEMPTS,
            )
        except Exception as exc:  # noqa: BLE001 — an agent/LLM failure is retryable
            last_exc = exc
            logger.warning(
                "%s attempt %s/%s raised: %s", label, attempt, _MAX_AGENT_ATTEMPTS, exc
            )
    return last_exc, final_output


def _log_agent_run(
    session: Session,
    *,
    application_id: uuid.UUID,
    input_summary: str,
    output_summary: str,
    status: AgentRunStatus,
    handed_off_to: str | None = None,
    agent_name: str = "Orchestrator Agent",
) -> None:
    """Write one ``agent_runs`` audit row (best-effort — never raises)."""
    try:
        session.add(
            AgentRun(
                agent_name=agent_name,
                application_id=application_id,
                input_summary=input_summary[:1000],
                output_summary=output_summary[:1000],
                handed_off_to=handed_off_to,
                status=status,
            )
        )
        session.commit()
    except Exception:  # noqa: BLE001 — auditing must not break the pipeline
        logger.exception("failed to write agent_runs row for %s", application_id)
        session.rollback()


async def run_resume_pipeline(application_id: uuid.UUID) -> None:
    """Parse the resume for ``application_id`` and advance its status.

    Resolves the candidate's stored resume, extracts text, runs the agent
    pipeline, then records the outcome. All failure modes (missing file, no
    extractable text, agent error) are caught and recorded as a failed
    ``agent_runs`` row so the recruiter dashboard reflects reality.
    """
    # 1. Load the application + candidate and resolve the stored resume key.
    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            logger.error("run_resume_pipeline: application %s not found", application_id)
            return
        candidate = session.get(Candidate, application.candidate_id)
        if candidate is None:
            logger.error(
                "run_resume_pipeline: candidate for application %s not found",
                application_id,
            )
            return
        resume_key = candidate.resume_file_url

    # Fire the Application Confirmation email as soon as we've confirmed the
    # application exists (Module 3 → Email Agent), independent of parse outcome.
    run_email_bg(application_id, "confirmation")

    # 2. Download + extract text (deterministic, non-AI). Any failure here is a
    #    terminal, recordable outcome — there's nothing for the agent to parse.
    try:
        if not resume_key:
            raise ResumeExtractionError("Candidate has no stored resume file")
        file_bytes = storage_service.read_resume(resume_key)
        resume_text = extract_text(file_bytes, resume_key)
    except (ResumeExtractionError, storage_service.StorageError) as exc:
        logger.warning("resume extraction failed for %s: %s", application_id, exc)
        with Session(engine) as session:
            _log_agent_run(
                session,
                application_id=application_id,
                input_summary=f"resume_key={resume_key}",
                output_summary=f"extraction_failed: {exc}",
                status=AgentRunStatus.failed,
            )
        events.publish(
            events.APPLICATION_UPDATED,
            application_id=str(application_id),
            status=ApplicationStatus.received.value,
            error="resume_extraction_failed",
        )
        return

    # 3. Run the agent pipeline with the trusted context carrying the app id.
    #    Retry until the parser actually calls a tool (saves data OR flags low
    #    confidence) — a flaky LLM turn that emits no tool call is re-attempted
    #    rather than recorded as a permanent parse failure.
    context = AgentRunContext(application_id=application_id)
    run_error, final_output = await _run_agent_with_retry(
        build_orchestrator_agent,
        resume_text,
        context,
        success=lambda: context.parsed_ok or context.low_confidence,
        label=f"Resume parse for {application_id}",
    )

    # 4–6. Decide outcome, transition status, audit, and broadcast.
    input_summary = f"resume_text[{len(resume_text)} chars]"

    if run_error is not None:
        with Session(engine) as session:
            _log_agent_run(
                session,
                application_id=application_id,
                input_summary=input_summary,
                output_summary=f"agent_error: {run_error}",
                status=AgentRunStatus.failed,
            )
        events.publish(
            events.APPLICATION_UPDATED,
            application_id=str(application_id),
            status=ApplicationStatus.received.value,
            error="agent_run_failed",
        )
        return

    if context.low_confidence:
        # The agent explicitly flagged it couldn't parse with confidence. Leave
        # the status at received for recruiter review; record the reason.
        with Session(engine) as session:
            _log_agent_run(
                session,
                application_id=application_id,
                input_summary=input_summary,
                output_summary=f"low_confidence: {context.low_confidence_reason}",
                status=AgentRunStatus.success,
                handed_off_to="Resume Parser Agent",
            )
        events.publish(
            events.APPLICATION_UPDATED,
            application_id=str(application_id),
            status=ApplicationStatus.received.value,
            low_confidence=True,
            reason=context.low_confidence_reason,
        )
        logger.info("application %s flagged low-confidence", application_id)
        return

    if not context.parsed_ok:
        # The agent finished without calling either tool — treat as a failure so
        # it doesn't silently stall in 'received'.
        with Session(engine) as session:
            _log_agent_run(
                session,
                application_id=application_id,
                input_summary=input_summary,
                output_summary=f"no_tool_called: {final_output[:200]}",
                status=AgentRunStatus.failed,
                handed_off_to="Resume Parser Agent",
            )
        events.publish(
            events.APPLICATION_UPDATED,
            application_id=str(application_id),
            status=ApplicationStatus.received.value,
            error="parser_no_output",
        )
        logger.warning("application %s: parser called no tool", application_id)
        return

    # Success: the parser saved structured data. Advance the status to 'parsed'.
    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is not None:
            application.status = ApplicationStatus.parsed
            application.updated_at = _utcnow()
            session.add(application)
            session.commit()
        _log_agent_run(
            session,
            application_id=application_id,
            input_summary=input_summary,
            output_summary="parsed_ok: structured resume data saved",
            status=AgentRunStatus.success,
            handed_off_to="Resume Parser Agent",
        )

    events.publish(
        events.APPLICATION_UPDATED,
        application_id=str(application_id),
        status=ApplicationStatus.parsed.value,
    )
    logger.info("application %s parsed successfully", application_id)

    # Parsing done → immediately score the candidate against the job (Module 5).
    await run_scoring_pipeline(application_id)


async def run_scoring_pipeline(application_id: uuid.UUID) -> None:
    """Score a parsed application against its job and advance status to 'scored'.

    Reads the candidate's ``parsed_data`` as the agent input, runs the Scoring
    Agent (which fetches the job description and calls ``save_score``), then
    records the outcome. Safe to call on its own — the recruiter can also
    re-trigger scoring for an application that already parsed.
    """
    # Lazily import so a scoring-only path doesn't force the parser's imports.
    from app.agents.scoring_agent import build_scoring_agent

    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            logger.error("run_scoring_pipeline: application %s not found", application_id)
            return
        candidate = session.get(Candidate, application.candidate_id)
        parsed = candidate.parsed_data if candidate else None

    if not parsed:
        logger.warning("run_scoring_pipeline: no parsed_data for %s", application_id)
        return

    agent_input = json.dumps(parsed)[:12000]
    context = AgentRunContext(application_id=application_id)

    # Retry until the Scoring Agent calls save_score — a flaky LLM turn that
    # ends without the tool call is re-attempted rather than left unscored.
    run_error, _ = await _run_agent_with_retry(
        build_scoring_agent,
        agent_input,
        context,
        success=lambda: context.scored_ok,
        label=f"Scoring for {application_id}",
    )

    if run_error is not None or not context.scored_ok:
        with Session(engine) as session:
            _log_agent_run(
                session,
                application_id=application_id,
                input_summary=f"parsed_data[{len(agent_input)} chars]",
                output_summary=(
                    f"scoring_error: {run_error}" if run_error else "no_score_saved"
                ),
                status=AgentRunStatus.failed,
                agent_name="Scoring Agent",
                handed_off_to="Scoring Agent",
            )
        events.publish(
            events.APPLICATION_UPDATED,
            application_id=str(application_id),
            status=ApplicationStatus.parsed.value,
            error="scoring_failed",
        )
        return

    # Success: save_score already wrote score/classification/explanation. Advance
    # the status to 'scored' so the recruiter dashboard surfaces it for a decision.
    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is not None:
            application.status = ApplicationStatus.scored
            application.updated_at = _utcnow()
            session.add(application)
            session.commit()
        _log_agent_run(
            session,
            application_id=application_id,
            input_summary=f"parsed_data[{len(agent_input)} chars]",
            output_summary=(
                f"scored_ok: {context.score} ({context.classification})"
            ),
            status=AgentRunStatus.success,
            agent_name="Scoring Agent",
            handed_off_to="Scoring Agent",
        )

    events.publish(
        events.APPLICATION_UPDATED,
        application_id=str(application_id),
        status=ApplicationStatus.scored.value,
        score=context.score,
        classification=context.classification,
    )
    logger.info(
        "application %s scored: %s (%s)",
        application_id,
        context.score,
        context.classification,
    )


def _utcnow():
    # Isolated so the model's updated_at stays consistent with the rest of the app.
    from datetime import datetime

    return datetime.utcnow()


async def run_email_pipeline(application_id: uuid.UUID, email_type: str) -> bool:
    """Send one branded email for an application via the Email Agent (Module 10).

    Returns True only if the email was actually sent (SMTP delivered), so callers
    can gate follow-on state (e.g. the interview-scheduled status) on real
    delivery rather than merely on the agent having run.
    """
    from app.agents.email_agent import build_email_agent

    context = AgentRunContext(application_id=application_id)
    try:
        await Runner.run(
            build_email_agent(),
            f"Send the '{email_type}' email for this application.",
            context=context,
            max_turns=_MAX_TURNS,
        )
        status = AgentRunStatus.success if context.email_sent else AgentRunStatus.failed
        out = f"email={context.email_type} sent={context.email_sent}"
    except Exception as exc:  # noqa: BLE001
        logger.exception("email pipeline failed for %s", application_id)
        status, out = AgentRunStatus.failed, f"email_error: {exc}"
    with Session(engine) as session:
        _log_agent_run(
            session,
            application_id=application_id,
            input_summary=f"email_type={email_type}",
            output_summary=out,
            status=status,
            agent_name="Email Agent",
        )
    return context.email_sent


async def run_scheduling_pipeline(
    application_id: uuid.UUID, preferred_start: str | None = None
) -> dict:
    """Book an interview via the Scheduling Agent, then send the invite (Module 9).

    Returns a result dict ``{"ok": bool, "stage": str}`` so a caller awaiting the
    pipeline (the /send-interview endpoint) can report a definitive success or
    failure to the UI instead of a fire-and-forget "started" ack:
      * ``{"ok": True,  "stage": "scheduled"}``       — booked AND invite emailed
      * ``{"ok": False, "stage": "scheduling_failed"}`` — no slot booked
      * ``{"ok": False, "stage": "slot_unavailable"}``  — preferred slot unusable
      * ``{"ok": False, "stage": "email_failed"}``     — booked but invite not sent

    When ``preferred_start`` is given the slot is booked deterministically (the
    recruiter's EXACT selected time is honoured, or a clear "unavailable" reason
    is returned) rather than via the LLM, which would otherwise pick the earliest
    free slot and drop the preference from the invitation email.
    """
    from app.agents.scheduling_agent import book_preferred_slot, build_scheduling_agent

    context = AgentRunContext(application_id=application_id)

    if preferred_start:
        # Deterministic path: honour the exact preferred date/time or explain why not.
        try:
            outcome = await book_preferred_slot(application_id, preferred_start)
        except Exception as exc:  # noqa: BLE001
            logger.exception("preferred-slot booking crashed for %s", application_id)
            outcome = {"ok": False, "reason": "Could not book the selected slot."}

        if not outcome.get("ok"):
            reason = outcome.get("reason") or "The selected time is unavailable."
            with Session(engine) as session:
                _log_agent_run(
                    session,
                    application_id=application_id,
                    input_summary=f"preferred_start={preferred_start}",
                    output_summary=f"slot_unavailable: {reason}",
                    status=AgentRunStatus.failed,
                    agent_name="Scheduling Agent",
                )
            events.publish(
                events.APPLICATION_UPDATED,
                application_id=str(application_id),
                error="slot_unavailable",
            )
            return {"ok": False, "stage": "slot_unavailable", "message": reason}

        context.interview_scheduled = True
        context.interview_action = "booked"
    else:
        prompt = "Schedule an interview for this application at the earliest suitable slot."
        try:
            await Runner.run(
                build_scheduling_agent(),
                prompt,
                context=context,
                max_turns=_MAX_TURNS,
            )
            run_error: Exception | None = None
        except Exception as exc:  # noqa: BLE001
            logger.exception("scheduling pipeline failed for %s", application_id)
            run_error = exc

        if run_error is not None or not context.interview_scheduled:
            with Session(engine) as session:
                _log_agent_run(
                    session,
                    application_id=application_id,
                    input_summary="schedule_request",
                    output_summary=f"scheduling_failed: {run_error}" if run_error else "no_slot_booked",
                    status=AgentRunStatus.failed,
                    agent_name="Scheduling Agent",
                )
            events.publish(
                events.APPLICATION_UPDATED,
                application_id=str(application_id),
                error="scheduling_failed",
            )
            return {"ok": False, "stage": "scheduling_failed"}

    # The slot is booked (calendar event + interviews row created by the agent),
    # but we must NOT advance the application to interview_scheduled until the
    # candidate has actually received the invitation email. Hand off first.
    with Session(engine) as session:
        _log_agent_run(
            session,
            application_id=application_id,
            input_summary="schedule_request",
            output_summary=f"interview {context.interview_action}",
            status=AgentRunStatus.success,
            agent_name="Scheduling Agent",
            handed_off_to="Email Agent",
        )
    email_sent = await run_email_pipeline(application_id, "interview_invite")

    if not email_sent:
        # Booking succeeded but the invite could not be delivered — do not
        # mislead the recruiter by showing "Interview Scheduled". Surface the
        # failure so it can be retried once email delivery is working.
        logger.error(
            "interview booked for %s but invitation email was not sent; "
            "leaving status unchanged", application_id
        )
        events.publish(
            events.APPLICATION_UPDATED,
            application_id=str(application_id),
            error="invite_email_failed",
        )
        return {"ok": False, "stage": "email_failed"}

    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is not None:
            application.status = ApplicationStatus.interview_scheduled
            application.updated_at = _utcnow()
            session.add(application)
            session.commit()
    events.publish(
        events.APPLICATION_UPDATED,
        application_id=str(application_id),
        status=ApplicationStatus.interview_scheduled.value,
    )
    return {"ok": True, "stage": "scheduled"}


async def run_reply_pipeline(application_id: uuid.UUID, reply_text: str) -> None:
    """Classify an inbound reply and act on it (Module 11).

    Reply Intent Agent classifies → runner drives the Scheduling Agent (cancel /
    reschedule) and Email Agent (confirmation of outcome) accordingly.
    """
    from app.agents.reply_intent_agent import build_reply_intent_agent
    from app.agents.scheduling_agent import build_scheduling_agent
    from app.models.interview import Interview, InterviewStatus

    context = AgentRunContext(application_id=application_id, reply_text=reply_text)
    try:
        await Runner.run(
            build_reply_intent_agent(),
            reply_text,
            context=context,
            max_turns=_MAX_TURNS,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("reply pipeline failed for %s", application_id)
        with Session(engine) as session:
            _log_agent_run(
                session,
                application_id=application_id,
                input_summary=f"reply[{len(reply_text)} chars]",
                output_summary=f"reply_error: {exc}",
                status=AgentRunStatus.failed,
                agent_name="Reply Intent Agent",
            )
        return

    intent = context.reply_intent
    follow_up_email = "reminder"  # default; overridden per branch

    if intent == "confirm":
        with Session(engine) as session:
            interview = _get_interview(session, application_id)
            if interview is not None:
                interview.status = InterviewStatus.confirmed
                session.add(interview)
                session.commit()
        follow_up_email = "interview_invite"  # re-confirm details
    elif intent == "needs_reschedule":
        # Cancel the old slot then book a fresh one via the Scheduling Agent.
        sctx = AgentRunContext(application_id=application_id)
        try:
            await Runner.run(
                build_scheduling_agent(),
                f"The candidate needs to reschedule. Reason: {context.reply_explanation or reply_text[:200]}. "
                "Cancel the current interview and book the earliest new suitable slot.",
                context=sctx,
                max_turns=_MAX_TURNS,
            )
        except Exception:  # noqa: BLE001
            logger.exception("reschedule via scheduling agent failed for %s", application_id)
        follow_up_email = "interview_invite"
    elif intent == "decline_permanently":
        sctx = AgentRunContext(application_id=application_id)
        try:
            await Runner.run(
                build_scheduling_agent(),
                f"The candidate has withdrawn. Cancel the interview. Reason: "
                f"{context.reply_explanation or reply_text[:200]}",
                context=sctx,
                max_turns=_MAX_TURNS,
            )
        except Exception:  # noqa: BLE001
            logger.exception("cancel via scheduling agent failed for %s", application_id)
        with Session(engine) as session:
            application = session.get(Application, application_id)
            if application is not None:
                application.status = ApplicationStatus.rejected
                application.updated_at = _utcnow()
                session.add(application)
                session.commit()
        follow_up_email = "rejection"

    with Session(engine) as session:
        _log_agent_run(
            session,
            application_id=application_id,
            input_summary=f"reply[{len(reply_text)} chars]",
            output_summary=f"intent={intent}; {context.reply_explanation or ''}",
            status=AgentRunStatus.success,
            agent_name="Reply Intent Agent",
            handed_off_to="Scheduling Agent, Email Agent",
        )
    events.publish(
        events.APPLICATION_UPDATED,
        application_id=str(application_id),
        reply_intent=intent,
    )
    # Email Agent confirms the outcome to the candidate in all three cases.
    await run_email_pipeline(application_id, follow_up_email)


def _get_interview(session: Session, application_id: uuid.UUID):
    from sqlmodel import select

    from app.models.interview import Interview

    return session.exec(
        select(Interview).where(Interview.application_id == application_id)
    ).first()


def _spawn(coro_factory, name: str) -> None:
    """Run an async coroutine on a daemon thread with its own event loop."""

    def _worker() -> None:
        try:
            asyncio.run(coro_factory())
        except Exception:  # noqa: BLE001
            logger.exception("background pipeline '%s' crashed", name)

    threading.Thread(target=_worker, name=name, daemon=True).start()


def run_resume_pipeline_bg(application_id: uuid.UUID) -> None:
    """Fire-and-forget launcher: run the resume→score pipeline off the request path."""
    _spawn(lambda: run_resume_pipeline(application_id), f"resume-pipeline-{application_id}")


def run_email_bg(application_id: uuid.UUID, email_type: str) -> None:
    """Fire-and-forget: send a branded email via the Email Agent."""
    _spawn(lambda: run_email_pipeline(application_id, email_type), f"email-{email_type}-{application_id}")


def run_scheduling_bg(application_id: uuid.UUID, preferred_start: str | None = None) -> None:
    """Fire-and-forget: book an interview and send the invite."""
    _spawn(
        lambda: run_scheduling_pipeline(application_id, preferred_start),
        f"schedule-{application_id}",
    )


def run_scheduling_sync(
    application_id: uuid.UUID, preferred_start: str | None = None
) -> dict:
    """Run the scheduling+invite pipeline to completion and return its result.

    Blocking, for use from a synchronous FastAPI endpoint (which runs in a
    threadpool): the request waits for the real outcome — book the slot AND send
    the invitation — so the UI resolves to a definitive success/failure instead
    of a fire-and-forget "started" ack. Never raises: a crash is reported as a
    failed result.
    """
    try:
        return asyncio.run(run_scheduling_pipeline(application_id, preferred_start))
    except Exception:  # noqa: BLE001
        logger.exception("scheduling pipeline crashed for %s", application_id)
        return {"ok": False, "stage": "scheduling_failed"}


def run_reply_bg(application_id: uuid.UUID, reply_text: str) -> None:
    """Fire-and-forget: classify an inbound reply and act on it."""
    _spawn(lambda: run_reply_pipeline(application_id, reply_text), f"reply-{application_id}")
