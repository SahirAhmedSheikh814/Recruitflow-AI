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
import uuid
from typing import List, Optional, Tuple

from agents import Agent, RunContextWrapper, function_tool
from sqlalchemy import text
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

# Interview statuses that occupy a time slot (a cancelled/completed interview
# does not block new bookings).
_ACTIVE_STATUSES = [
    InterviewStatus.proposed,
    InterviewStatus.confirmed,
    InterviewStatus.rescheduled,
]


def _overlaps(a_start: dt.datetime, a_end: dt.datetime, b_start: dt.datetime, b_end: dt.datetime) -> bool:
    """True when [a_start, a_end) and [b_start, b_end) intersect.

    Half-open intervals, so back-to-back slots (09:00–10:00 and 10:00–11:00) do
    NOT overlap. Inputs may be in different timezones — Python compares aware
    datetimes by absolute instant, so the result is timezone-correct.
    """
    return a_start < b_end and b_start < a_end


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


def _resolve(
    application_id,
) -> Tuple[Optional[Application], Optional[RecruiterProfile], Optional[uuid.UUID]]:
    """Load the application, the owning recruiter's profile, and recruiter id.

    The recruiter id is the identity we serialise bookings on (advisory lock) and
    scope DB conflict checks to, so it is resolved here from the trusted
    application → job chain, never from the model.
    """
    with Session(engine) as session:
        application = session.get(Application, application_id)
        if application is None:
            return None, None, None
        job = session.get(Job, application.job_id)
        profile = None
        recruiter_id = job.recruiter_id if job is not None else None
        if job is not None:
            profile = session.exec(
                select(RecruiterProfile).where(RecruiterProfile.user_id == job.recruiter_id)
            ).first()
        return application, profile, recruiter_id


def _working_window(profile: Optional[RecruiterProfile], day: dt.date) -> Tuple[dt.datetime, dt.datetime]:
    """The recruiter's working-hours window for a given LOCAL day, returned as
    UTC-aware datetimes.

    ``working_hours_start``/``end`` (e.g. "09:00") are wall-clock times in the
    business timezone (``APP_TIMEZONE``). We anchor them to that day in the local
    zone, then convert to UTC so all downstream comparisons are in UTC.
    """
    start_s = (profile.working_hours_start if profile else None) or "09:00"
    end_s = (profile.working_hours_end if profile else None) or "17:00"
    sh, sm = (int(x) for x in start_s.split(":"))
    eh, em = (int(x) for x in end_s.split(":"))
    tz = calendar_service.app_timezone()
    local_start = dt.datetime(day.year, day.month, day.day, sh, sm, tzinfo=tz)
    local_end = dt.datetime(day.year, day.month, day.day, eh, em, tzinfo=tz)
    return (
        local_start.astimezone(dt.timezone.utc),
        local_end.astimezone(dt.timezone.utc),
    )


def _candidate_slots(
    profile: Optional[RecruiterProfile],
    busy: List[Tuple[dt.datetime, dt.datetime]],
    days_ahead: int,
    now: dt.datetime,
) -> List[Tuple[dt.datetime, dt.datetime]]:
    """Generate 1-hour weekday slots in working hours, minus busy intervals.

    Days and the weekday check are evaluated in the business timezone so "weekday"
    and "working hours" mean what the recruiter expects; the emitted slots are
    UTC-aware. ``busy`` already merges Google Calendar busy times AND active DB
    interviews, so a slot already taken in our own DB is never proposed.
    """
    tz = calendar_service.app_timezone()
    local_now = now.astimezone(tz)
    slots: List[Tuple[dt.datetime, dt.datetime]] = []
    for d in range(1, days_ahead + 1):
        day = (local_now + dt.timedelta(days=d)).date()
        if day.weekday() >= 5:  # Sat/Sun (local)
            continue
        win_start, win_end = _working_window(profile, day)
        cur = win_start
        while cur + dt.timedelta(minutes=SLOT_MINUTES) <= win_end:
            slot_end = cur + dt.timedelta(minutes=SLOT_MINUTES)
            overlaps = any(_overlaps(cur, slot_end, b0, b1) for b0, b1 in busy)
            if not overlaps and cur > now:
                slots.append((cur, slot_end))
            cur = slot_end
        if len(slots) >= 8:
            break
    return slots[:8]


def _db_busy_for_recruiter(
    recruiter_id: Optional[uuid.UUID],
    session: Session,
    exclude_application_id=None,
) -> List[Tuple[dt.datetime, dt.datetime]]:
    """Active interview intervals (UTC-aware) for THIS recruiter's applications.

    Scoped via interviews → applications → jobs.recruiter_id so one recruiter's
    calendar never blocks another's. Used both to hide taken slots from proposals
    and as the authoritative conflict check at insert time.
    """
    if recruiter_id is None:
        return []
    rows = session.exec(
        select(Interview)
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(Job.recruiter_id == recruiter_id, Interview.status.in_(_ACTIVE_STATUSES))
    ).all()
    out: List[Tuple[dt.datetime, dt.datetime]] = []
    for iv in rows:
        if exclude_application_id is not None and iv.application_id == exclude_application_id:
            continue
        if iv.scheduled_start is None or iv.scheduled_end is None:
            continue
        out.append((_db_to_utc(iv.scheduled_start), _db_to_utc(iv.scheduled_end)))
    return out


@function_tool(strict_mode=False)
async def get_free_busy(ctx: RunContextWrapper[AgentRunContext], days_ahead: int = 7) -> str:
    """Return concrete available interview slots (JSON list of {start_iso,end_iso})."""
    application, profile, recruiter_id = _resolve(ctx.context.application_id)
    if application is None:
        return json.dumps({"error": "application not found"})

    now = dt.datetime.now(dt.timezone.utc)
    horizon = now + dt.timedelta(days=max(1, min(days_ahead, 21)))
    busy: List[Tuple[dt.datetime, dt.datetime]] = []

    token = profile.google_refresh_token if profile else None
    if token and calendar_service.is_configured():
        try:
            busy.extend(await calendar_service.get_free_busy(token, now, horizon))
        except calendar_service.CalendarAuthError as exc:
            logger.warning("calendar auth invalid during free/busy: %s", exc)
        except calendar_service.CalendarError as exc:
            logger.warning("free/busy lookup failed: %s", exc)

    # Always merge in interviews already booked in our own DB for this recruiter,
    # so the earliest-slot path can never re-propose a taken slot even when no
    # Google Calendar is connected.
    with Session(engine) as session:
        busy.extend(
            _db_busy_for_recruiter(recruiter_id, session, exclude_application_id=application.id)
        )

    slots = _candidate_slots(profile, busy, max(1, min(days_ahead, 21)), now)
    return json.dumps(
        {
            "calendar_connected": bool(token),
            "slots": [{"start_iso": s.isoformat(), "end_iso": e.isoformat()} for s, e in slots],
        }
    )


async def _create_calendar_event(profile, application, start, end) -> Optional[str]:
    """Create the Google event for a booking, or None if no calendar is connected.

    Raises ``CalendarError``/``CalendarAuthError`` on a real Google failure so the
    caller can decide NOT to persist the interview (we must never report a booking
    as scheduled when a *connected* calendar rejected the event). Returns None
    only in dormant mode (no token / not configured), where booking-without-event
    is the intended, demonstrable behaviour.
    """
    token = profile.google_refresh_token if profile else None
    if not (token and calendar_service.is_configured()):
        return None
    with Session(engine) as session:
        from app.models.candidate import Candidate

        cand = session.get(Candidate, application.candidate_id)
        job = session.get(Job, application.job_id)
    return await calendar_service.create_event(
        token,
        summary=f"Interview — {job.title if job else 'Role'}",
        start=start,
        end=end,
        attendee_email=cand.email if cand else None,
        description="Interview scheduled by RecruitFlow AI.",
    )


def _db_to_utc(value: dt.datetime) -> dt.datetime:
    """Interpret a datetime read from the DB as UTC-aware.

    ``interviews.scheduled_start/end`` are stored as naive UTC wall-clock (the
    column is TIMESTAMP WITHOUT TIME ZONE and we always write UTC). Stamping UTC
    on read makes them safely comparable with timezone-aware values.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value.astimezone(dt.timezone.utc)


def _parse_preferred(preferred_start: str) -> dt.datetime:
    """Parse the recruiter's picked start into a UTC-aware datetime.

    The SlotPicker sends a naive local wall-clock string (``YYYY-MM-DDTHH:mm``,
    no offset). We anchor it to the business timezone (``APP_TIMEZONE``) — NOT
    UTC — then convert to UTC. If the string already carries an offset we honour
    it. This is the fix for "09:00 meant a different instant everywhere".
    """
    parsed = dt.datetime.fromisoformat(preferred_start)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=calendar_service.app_timezone())
    return parsed.astimezone(dt.timezone.utc)


def _advisory_lock(session: Session, recruiter_id: Optional[uuid.UUID]) -> None:
    """Take a transaction-scoped advisory lock keyed by recruiter (Postgres only).

    Serialises concurrent bookings for the SAME recruiter so the check-then-insert
    below is atomic: a second concurrent request blocks here until the first
    commits, then sees the freshly-inserted row and is correctly rejected. The
    lock releases automatically at COMMIT/ROLLBACK (``pg_advisory_xact_lock``), so
    it is safe under Neon/pgbouncer transaction pooling. No-ops on SQLite (tests).
    """
    if recruiter_id is None:
        return
    if session.bind is None or session.bind.dialect.name != "postgresql":
        return
    # 63-bit key from the recruiter UUID (advisory locks take a bigint).
    key = (recruiter_id.int >> 64) ^ (recruiter_id.int & ((1 << 64) - 1))
    key = key & ((1 << 63) - 1)
    session.exec(text("SELECT pg_advisory_xact_lock(:k)").bindparams(k=key))


async def _commit_booking(
    application,
    profile,
    recruiter_id: Optional[uuid.UUID],
    start: dt.datetime,
    end: dt.datetime,
) -> dict:
    """Atomically verify the slot is free and create the interview + calendar event.

    Ordering that makes double-booking impossible:
      1. Google Calendar pre-check (fast, connected calendars only).
      2. Acquire the per-recruiter advisory lock (serialises concurrent requests).
      3. Re-check our DB for an overlapping active interview (authoritative).
      4. Create the Google event (if connected) — abort WITHOUT inserting on a
         real calendar failure, so we never persist a phantom booking.
      5. Insert the ``proposed`` interviews row and COMMIT (releases the lock).

    Returns ``{"ok": True, "start_iso", "end_iso"}`` or
    ``{"ok": False, "reason", "code"}`` where code ∈ {conflict, calendar_auth,
    calendar_failed}.
    """
    start = _db_to_utc(start)
    end = _db_to_utc(end)
    token = profile.google_refresh_token if profile else None

    # 1) Google pre-check for a friendly early rejection.
    if token and calendar_service.is_configured():
        try:
            busy = await calendar_service.get_free_busy(token, start, end)
            if any(_overlaps(start, end, b0, b1) for b0, b1 in busy):
                return {
                    "ok": False,
                    "code": "conflict",
                    "reason": "The selected time conflicts with another event on the calendar. Please choose another slot.",
                }
        except calendar_service.CalendarAuthError as exc:
            logger.warning("calendar auth invalid during booking pre-check: %s", exc)
            _mark_calendar_disconnected(recruiter_id)
            return {
                "ok": False,
                "code": "calendar_auth",
                "reason": "Your Google Calendar connection has expired. Please reconnect Google Calendar in Settings and try again.",
            }
        except calendar_service.CalendarError as exc:
            # Availability unknown from Google — fall back to the DB check under
            # the lock rather than block booking entirely.
            logger.warning("free/busy pre-check failed (continuing with DB check): %s", exc)

    # 2-5) Atomic check-then-insert under the recruiter lock.
    with Session(engine) as session:
        _advisory_lock(session, recruiter_id)

        db_busy = _db_busy_for_recruiter(
            recruiter_id, session, exclude_application_id=application.id
        )
        if any(_overlaps(start, end, b0, b1) for b0, b1 in db_busy):
            return {
                "ok": False,
                "code": "conflict",
                "reason": "The selected time conflicts with another scheduled interview. Please choose another slot.",
            }

        # Create the Google event while holding the lock so no concurrent booking
        # can slip in between the check and the insert.
        try:
            event_id = await _create_calendar_event(profile, application, start, end)
        except calendar_service.CalendarAuthError as exc:
            logger.warning("calendar auth invalid creating event: %s", exc)
            _mark_calendar_disconnected(recruiter_id)
            return {
                "ok": False,
                "code": "calendar_auth",
                "reason": "Your Google Calendar connection has expired. Please reconnect Google Calendar in Settings and try again.",
            }
        except calendar_service.CalendarError as exc:
            logger.error("calendar event creation failed; not booking: %s", exc)
            return {
                "ok": False,
                "code": "calendar_failed",
                "reason": "The interview could not be added to Google Calendar. Please try again.",
            }

        interview = Interview(
            application_id=application.id,
            google_event_id=event_id,
            scheduled_start=start.replace(tzinfo=None),  # store naive UTC
            scheduled_end=end.replace(tzinfo=None),
            status=InterviewStatus.proposed,
        )
        session.add(interview)
        session.commit()

    return {"ok": True, "start_iso": start.isoformat(), "end_iso": end.isoformat()}


def _mark_calendar_disconnected(recruiter_id: Optional[uuid.UUID]) -> None:
    """Flag the recruiter's calendar as disconnected after a revoked/expired token,
    so the dashboard shows a Connect button and we stop retrying a dead token."""
    if recruiter_id is None:
        return
    with Session(engine) as session:
        profile = session.exec(
            select(RecruiterProfile).where(RecruiterProfile.user_id == recruiter_id)
        ).first()
        if profile is not None:
            profile.google_calendar_connected = False
            profile.google_refresh_token = None
            session.add(profile)
            session.commit()


async def book_preferred_slot(application_id, preferred_start: str) -> dict:
    """Deterministically book the recruiter's exact preferred slot, or explain why not.

    Unlike the LLM path (which picks the earliest free slot), this honours the
    EXACT date/time the recruiter selected (interpreted in the business timezone).
    It validates the slot is a future weekday time inside working hours, then
    delegates to the shared atomic booking core, which checks BOTH Google Calendar
    and our own DB under a per-recruiter lock before creating the event + row.

    Returns ``{"ok": True, "start_iso", "end_iso"}`` on success, or
    ``{"ok": False, "reason": <human message>}`` when the slot can't be used.
    """
    application, profile, recruiter_id = _resolve(application_id)
    if application is None:
        return {"ok": False, "reason": "Application not found."}

    try:
        start = _parse_preferred(preferred_start)
    except ValueError:
        return {"ok": False, "reason": "The selected date and time are not valid."}
    end = start + dt.timedelta(minutes=SLOT_MINUTES)

    now = dt.datetime.now(dt.timezone.utc)
    if start <= now:
        return {"ok": False, "reason": "The selected time is in the past. Please choose a future slot."}

    # Weekday + working-hours checks in the business timezone.
    tz = calendar_service.app_timezone()
    local_day = start.astimezone(tz).date()
    if local_day.weekday() >= 5:
        return {
            "ok": False,
            "reason": "The selected time falls on a weekend. Please choose a weekday within working hours.",
        }
    win_start, win_end = _working_window(profile, local_day)
    if start < win_start or end > win_end:
        return {
            "ok": False,
            "reason": (
                f"The selected time is outside working hours "
                f"({win_start.astimezone(tz).strftime('%H:%M')}–{win_end.astimezone(tz).strftime('%H:%M')}). "
                "Please choose a slot within working hours."
            ),
        }

    return await _commit_booking(application, profile, recruiter_id, start, end)


@function_tool(strict_mode=False)
async def book_interview(ctx: RunContextWrapper[AgentRunContext], start_iso: str, end_iso: str) -> str:
    """Create the interview event + a proposed interviews row.

    Args:
        start_iso: Slot start, ISO 8601.
        end_iso: Slot end, ISO 8601.
    """
    application, profile, recruiter_id = _resolve(ctx.context.application_id)
    if application is None:
        return "Error: application not found."
    try:
        start = dt.datetime.fromisoformat(start_iso)
        end = dt.datetime.fromisoformat(end_iso)
    except ValueError:
        return "Error: start_iso/end_iso must be ISO 8601 datetimes."

    # Route through the shared atomic core so the LLM path enforces the SAME
    # Google + DB conflict checks (under the per-recruiter lock) as the
    # deterministic path — no double-booking regardless of which path books.
    outcome = await _commit_booking(application, profile, recruiter_id, start, end)
    if not outcome.get("ok"):
        return f"Error: {outcome.get('reason', 'slot unavailable')}"

    ctx.context.interview_scheduled = True
    ctx.context.interview_action = "booked"
    return f"Interview proposed for {outcome['start_iso']}."


@function_tool(strict_mode=False)
async def reschedule_interview(ctx: RunContextWrapper[AgentRunContext], start_iso: str, end_iso: str) -> str:
    """Move the application's existing interview to a new slot."""
    application, profile, recruiter_id = _resolve(ctx.context.application_id)
    if application is None:
        return "Error: application not found."
    try:
        start = _db_to_utc(dt.datetime.fromisoformat(start_iso))
        end = _db_to_utc(dt.datetime.fromisoformat(end_iso))
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
        interview.scheduled_start = start.replace(tzinfo=None)  # store naive UTC
        interview.scheduled_end = end.replace(tzinfo=None)
        interview.status = InterviewStatus.rescheduled
        session.add(interview)
        session.commit()
    ctx.context.interview_scheduled = True
    ctx.context.interview_action = "rescheduled"
    return f"Interview rescheduled to {start_iso}."


@function_tool(strict_mode=False)
async def cancel_interview(ctx: RunContextWrapper[AgentRunContext], reason: str) -> str:
    """Cancel the application's interview and record the reason."""
    application, profile, recruiter_id = _resolve(ctx.context.application_id)
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
