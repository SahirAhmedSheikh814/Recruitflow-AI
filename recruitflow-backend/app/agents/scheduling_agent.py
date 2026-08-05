"""Scheduling Agent (Module 9).

Finds an interview slot and manages the calendar event + ``interviews`` row for
an application. Single-purpose per the "one Agent per task" rule.

Tools:
  * ``get_free_busy(days_ahead)`` — returns concrete candidate slots inside the
    recruiter's working hours, with the recruiter's busy times removed (when a
    calendar is connected). The agent just picks one.
  * ``book_interview(start_iso, end_iso)`` — creates the calendar event (if the
    recruiter connected Google Calendar) and a ``proposed`` interviews row.
  * ``reschedule_interview(start_iso, end_iso)`` — moves the existing event/row.
  * ``cancel_interview(reason)`` — cancels the event and marks the row cancelled.

The recruiter + candidate are resolved from the trusted context's application id,
never the model. Calendar operations are dormant until a recruiter connects
their calendar; without a token, slots are still proposed and the interviews row
is still written (with no ``google_event_id``) so the flow is fully demonstrable.
"""
from __future__ import annotations

import datetime as dt
import json
import logging
from typing import List, Optional, Tuple

from agents import Agent, RunContextWrapper, function_tool
from sqlmodel import Session, select

from app.agents.context import AgentRunContext
from app.agents.llm_config import get_agent_model
from app.db.session import engine
from app.models.application import Application
from app.models.interview import Interview, InterviewStatus
from app.models.job import Job
from app.models.recruiter_profile import RecruiterProfile
from app.services import calendar_service

logger = logging.getLogger("recruitflow.agents.scheduling")

SLOT_MINUTES = 60


PROMPT = """\
You are the Scheduling Agent for RecruitFlow AI, an AI recruitment system.

You schedule (or change) ONE interview for the current application. Do this:
1. Call `get_free_busy` (optionally with days_ahead, default 7) to get concrete
   available slots inside the recruiter's working hours.
2. Pick the EARLIEST suitable slot and call `book_interview` with its start_iso
   and end_iso exactly as given.
   - If you were asked to reschedule instead, call `reschedule_interview`.
   - If you were asked to cancel, call `cancel_interview` with a short reason.
Then stop. Do not write prose back to the user. Times are ISO 8601 UTC.
"""


def _resolve(application_id) -> Tuple[Optional[Application], Optional[RecruiterProfile]]:
    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            return None, None
        job = session.get(Job, application.job_id)
        profile = None
        if job is not None:
            profile = session.exec(
                select(RecruiterProfile).where(RecruiterProfile.user_id == job.recruiter_id)
            ).first()
        return application, profile


def _working_window(profile: Optional[RecruiterProfile], day: dt.date) -> Tuple[dt.datetime, dt.datetime]:
    start_s = (profile.working_hours_start if profile else None) or "09:00"
    end_s = (profile.working_hours_end if profile else None) or "17:00"
    sh, sm = (int(x) for x in start_s.split(":"))
    eh, em = (int(x) for x in end_s.split(":"))
    tz = dt.timezone.utc
    return (
        dt.datetime(day.year, day.month, day.day, sh, sm, tzinfo=tz),
        dt.datetime(day.year, day.month, day.day, eh, em, tzinfo=tz),
    )


def _candidate_slots(
    profile: Optional[RecruiterProfile],
    busy: List[Tuple[dt.datetime, dt.datetime]],
    days_ahead: int,
    now: dt.datetime,
) -> List[Tuple[dt.datetime, dt.datetime]]:
    """Generate 1-hour weekday slots in working hours, minus busy intervals."""
    slots: List[Tuple[dt.datetime, dt.datetime]] = []
    for d in range(1, days_ahead + 1):
        day = (now + dt.timedelta(days=d)).date()
        if day.weekday() >= 5:  # Sat/Sun
            continue
        win_start, win_end = _working_window(profile, day)
        cur = win_start
        while cur + dt.timedelta(minutes=SLOT_MINUTES) <= win_end:
            slot_end = cur + dt.timedelta(minutes=SLOT_MINUTES)
            overlaps = any(b0 < slot_end and cur < b1 for b0, b1 in busy)
            if not overlaps:
                slots.append((cur, slot_end))
            cur = slot_end
        if len(slots) >= 8:
            break
    return slots[:8]


@function_tool(strict_mode=False)
async def get_free_busy(ctx: RunContextWrapper[AgentRunContext], days_ahead: int = 7) -> str:
    """Return concrete available interview slots (JSON list of {start_iso,end_iso})."""
    application, profile = _resolve(ctx.context.application_id)
    if application is None:
        return json.dumps({"error": "application not found"})

    now = dt.datetime.now(dt.timezone.utc)
    busy: List[Tuple[dt.datetime, dt.datetime]] = []
    token = profile.google_refresh_token if profile else None
    if token and calendar_service.is_configured():
        try:
            busy = await calendar_service.get_free_busy(
                token, now, now + dt.timedelta(days=max(1, days_ahead))
            )
        except calendar_service.CalendarError as exc:
            logger.warning("free/busy lookup failed: %s", exc)

    slots = _candidate_slots(profile, busy, max(1, min(days_ahead, 21)), now)
    return json.dumps(
        {
            "calendar_connected": bool(token),
            "slots": [{"start_iso": s.isoformat(), "end_iso": e.isoformat()} for s, e in slots],
        }
    )


async def _create_calendar_event(profile, application, start, end) -> Optional[str]:
    token = profile.google_refresh_token if profile else None
    if not (token and calendar_service.is_configured()):
        return None
    with Session(engine) as session:
        from app.models.candidate import Candidate

        cand = session.get(Candidate, application.candidate_id)
        job = session.get(Job, application.job_id)
    try:
        return await calendar_service.create_event(
            token,
            summary=f"Interview — {job.title if job else 'Role'}",
            start=start,
            end=end,
            attendee_email=cand.email if cand else None,
            description="Interview scheduled by RecruitFlow AI.",
        )
    except calendar_service.CalendarError as exc:
        logger.warning("calendar create failed: %s", exc)
        return None


def _to_utc(value: dt.datetime) -> dt.datetime:
    """Normalize a naive datetime to UTC (assume UTC); pass through aware ones."""
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


async def book_preferred_slot(application_id, preferred_start: str) -> dict:
    """Deterministically book the recruiter's exact preferred slot, or explain why not.

    Unlike the LLM path (which picks the earliest free slot), this honours the
    EXACT date/time the recruiter selected. It validates the slot is a future
    weekday time inside working hours and free of any conflict (Google Calendar
    busy times when connected, plus existing interviews in the DB), then creates
    the calendar event + a ``proposed`` interviews row.

    Returns ``{"ok": True, "start_iso", "end_iso"}`` on success, or
    ``{"ok": False, "reason": <human message>}`` when the slot can't be used, so
    the caller can surface an "unavailable" message to the recruiter.
    """
    application, profile = _resolve(application_id)
    if application is None:
        return {"ok": False, "reason": "Application not found."}

    try:
        start = _to_utc(dt.datetime.fromisoformat(preferred_start))
    except ValueError:
        return {"ok": False, "reason": "The selected date and time are not valid."}
    end = start + dt.timedelta(minutes=SLOT_MINUTES)

    now = dt.datetime.now(dt.timezone.utc)
    if start <= now:
        return {"ok": False, "reason": "The selected time is in the past. Please choose a future slot."}
    if start.weekday() >= 5:
        return {
            "ok": False,
            "reason": "The selected time falls on a weekend. Please choose a weekday within working hours.",
        }

    win_start, win_end = _working_window(profile, start.date())
    if start < win_start or end > win_end:
        return {
            "ok": False,
            "reason": (
                f"The selected time is outside working hours "
                f"({win_start.strftime('%H:%M')}–{win_end.strftime('%H:%M')} UTC). "
                "Please choose a slot within working hours."
            ),
        }

    # Conflict check against the recruiter's Google Calendar busy intervals.
    token = profile.google_refresh_token if profile else None
    if token and calendar_service.is_configured():
        try:
            busy = await calendar_service.get_free_busy(token, start, end)
            if any(_to_utc(b0) < end and start < _to_utc(b1) for b0, b1 in busy):
                return {
                    "ok": False,
                    "reason": "The selected time conflicts with another event on the calendar. Please choose another slot.",
                }
        except calendar_service.CalendarError as exc:
            logger.warning("free/busy lookup failed during preferred booking: %s", exc)

    # Conflict check against other active interviews already in the database.
    with Session(engine) as session:
        existing = session.exec(
            select(Interview).where(
                Interview.status.in_(
                    [
                        InterviewStatus.proposed,
                        InterviewStatus.confirmed,
                        InterviewStatus.rescheduled,
                    ]
                )
            )
        ).all()
    for iv in existing:
        if iv.application_id == application_id:
            continue
        if iv.scheduled_start is None or iv.scheduled_end is None:
            continue
        if _to_utc(iv.scheduled_start) < end and start < _to_utc(iv.scheduled_end):
            return {
                "ok": False,
                "reason": "The selected time conflicts with another scheduled interview. Please choose another slot.",
            }

    # Slot is valid and free — create the event + proposed interviews row.
    event_id = await _create_calendar_event(profile, application, start, end)
    with Session(engine) as session:
        interview = Interview(
            application_id=application_id,
            google_event_id=event_id,
            scheduled_start=start,
            scheduled_end=end,
            status=InterviewStatus.proposed,
        )
        session.add(interview)
        session.commit()
    return {"ok": True, "start_iso": start.isoformat(), "end_iso": end.isoformat()}


@function_tool(strict_mode=False)
async def book_interview(ctx: RunContextWrapper[AgentRunContext], start_iso: str, end_iso: str) -> str:
    """Create the interview event + a proposed interviews row.

    Args:
        start_iso: Slot start, ISO 8601.
        end_iso: Slot end, ISO 8601.
    """
    application, profile = _resolve(ctx.context.application_id)
    if application is None:
        return "Error: application not found."
    try:
        start = dt.datetime.fromisoformat(start_iso)
        end = dt.datetime.fromisoformat(end_iso)
    except ValueError:
        return "Error: start_iso/end_iso must be ISO 8601 datetimes."

    event_id = await _create_calendar_event(profile, application, start, end)
    with Session(engine) as session:
        interview = Interview(
            application_id=ctx.context.application_id,
            google_event_id=event_id,
            scheduled_start=start,
            scheduled_end=end,
            status=InterviewStatus.proposed,
        )
        session.add(interview)
        session.commit()
    ctx.context.interview_scheduled = True
    ctx.context.interview_action = "booked"
    return f"Interview proposed for {start_iso} (calendar_event={'yes' if event_id else 'none'})."


@function_tool(strict_mode=False)
async def reschedule_interview(ctx: RunContextWrapper[AgentRunContext], start_iso: str, end_iso: str) -> str:
    """Move the application's existing interview to a new slot."""
    application, profile = _resolve(ctx.context.application_id)
    if application is None:
        return "Error: application not found."
    try:
        start = dt.datetime.fromisoformat(start_iso)
        end = dt.datetime.fromisoformat(end_iso)
    except ValueError:
        return "Error: start_iso/end_iso must be ISO 8601 datetimes."

    token = profile.google_refresh_token if profile else None
    with Session(engine) as session:
        interview = session.exec(
            select(Interview).where(Interview.application_id == ctx.context.application_id)
        ).first()
        if interview is None:
            return "Error: no existing interview to reschedule."
        if interview.google_event_id and token and calendar_service.is_configured():
            try:
                await calendar_service.update_event(token, interview.google_event_id, start=start, end=end)
            except calendar_service.CalendarError as exc:
                logger.warning("calendar update failed: %s", exc)
        interview.scheduled_start = start
        interview.scheduled_end = end
        interview.status = InterviewStatus.rescheduled
        session.add(interview)
        session.commit()
    ctx.context.interview_scheduled = True
    ctx.context.interview_action = "rescheduled"
    return f"Interview rescheduled to {start_iso}."


@function_tool(strict_mode=False)
async def cancel_interview(ctx: RunContextWrapper[AgentRunContext], reason: str) -> str:
    """Cancel the application's interview and record the reason."""
    application, profile = _resolve(ctx.context.application_id)
    if application is None:
        return "Error: application not found."
    token = profile.google_refresh_token if profile else None
    with Session(engine) as session:
        interview = session.exec(
            select(Interview).where(Interview.application_id == ctx.context.application_id)
        ).first()
        if interview is None:
            return "Error: no interview to cancel."
        if interview.google_event_id and token and calendar_service.is_configured():
            try:
                await calendar_service.cancel_event(token, interview.google_event_id)
            except calendar_service.CalendarError as exc:
                logger.warning("calendar cancel failed: %s", exc)
        interview.status = InterviewStatus.cancelled
        interview.cancellation_reason = (reason or "").strip()[:500]
        session.add(interview)
        session.commit()
    ctx.context.interview_scheduled = False
    ctx.context.interview_action = "cancelled"
    return "Interview cancelled."


def build_scheduling_agent() -> Agent[AgentRunContext]:
    """Construct the Scheduling Agent."""
    return Agent[AgentRunContext](
        name="Scheduling Agent",
        instructions=PROMPT,
        model=get_agent_model(),
        tools=[get_free_busy, book_interview, reschedule_interview, cancel_interview],
    )
