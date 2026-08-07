"""Google Calendar integration (Module 8).

Thin, dependency-light client over the Google Calendar REST API (via ``httpx``,
matching :mod:`app.services.google_oauth` — no heavy google-api-python-client).
It provides everything the Scheduling Agent's tools need:

  * a separate OAuth consent flow scoped to Calendar (the recruiter "Connect
    Google Calendar" button), returning a long-lived refresh token which is
    stored **encrypted** on ``recruiter_profiles`` (see :mod:`app.core.crypto`);
  * ``get_free_busy`` (the Scheduling Agent subtracts these from working hours);
  * ``create_event`` / ``update_event`` / ``cancel_event``.

Everything here is dormant until a recruiter connects their calendar; the code
paths are exercised only once ``recruiter_profiles.google_refresh_token`` is set.
Access tokens are short-lived and fetched on demand from the stored refresh
token, so nothing long-lived is kept in memory.
"""
from __future__ import annotations

import datetime as dt
import logging
import os
from typing import List, Optional, Tuple
from urllib.parse import urlencode
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from app.core import crypto

logger = logging.getLogger("recruitflow.calendar")

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
EVENTS_API = f"{CALENDAR_API}/calendars/primary/events"

# A single scope covers every calendar operation this app performs:
#   * list events in a window  → read availability / detect overlaps
#   * create / patch / delete   → book, reschedule, cancel interviews
# ``calendar.events`` authorises all of the above, so we deliberately do NOT
# request the broader ``calendar`` / ``calendar.readonly`` scopes. Availability
# is read via ``events.list`` (below), NOT the freeBusy endpoint, precisely
# because freeBusy would require an extra read scope this app doesn't need.
CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"]


class CalendarError(Exception):
    """Raised when a Google Calendar operation fails."""


class CalendarAuthError(CalendarError):
    """Raised when the stored authorization is no longer valid (refresh token
    revoked/expired, or decryption failed). Callers should mark the recruiter's
    calendar disconnected and prompt them to reconnect."""


def app_timezone() -> dt.tzinfo:
    """The business timezone the app interprets recruiter-entered wall-clock times
    in, from the ``APP_TIMEZONE`` env var (IANA name, e.g. ``Australia/Sydney``).

    Defaults to UTC so behaviour is unchanged unless explicitly configured. All
    overlap/conflict math is done in UTC internally; this only governs how a
    naive "09:00" is anchored to a real instant and how events are displayed.

    Robust to a missing IANA database (slim Docker image / Windows without the
    ``tzdata`` package): an unknown or unloadable zone falls back to UTC, and if
    even ``ZoneInfo("UTC")`` can't load, stdlib ``timezone.utc`` is the last resort
    so the app never crashes at import/first-call time.
    """
    name = os.environ.get("APP_TIMEZONE", "UTC")
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning("APP_TIMEZONE=%r is not a valid/loadable IANA zone; falling back to UTC", name)
    try:
        return ZoneInfo("UTC")
    except ZoneInfoNotFoundError:  # no tzdata at all → stdlib UTC needs none
        return dt.timezone.utc


def app_timezone_name() -> str:
    """The configured timezone name (validated), for Google's ``timeZone`` field."""
    return getattr(app_timezone(), "key", None) or "UTC"


def _client_id() -> str:
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    if not cid:
        raise CalendarError("GOOGLE_CLIENT_ID is not configured")
    return cid


def _client_secret() -> str:
    secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not secret:
        raise CalendarError("GOOGLE_CLIENT_SECRET is not configured")
    return secret


def _redirect_uri() -> str:
    """The calendar OAuth callback — must be a **backend** URL and must exactly
    match an Authorized Redirect URI on the Google OAuth client.

    Resolution order (first non-empty wins):
      1. ``GOOGLE_CALENDAR_REDIRECT_URI`` — set this explicitly in production, e.g.
         ``https://recruitflow-ai-3u84.onrender.com/interviews/calendar/callback``
      2. ``BACKEND_URL`` + ``/interviews/calendar/callback``
      3. local dev default on port 7860

    Deliberately NOT derived from ``GOOGLE_REDIRECT_URI`` (the candidate-login
    callback), which is proxied through the website's Vercel domain — routing the
    calendar callback through that proxy is what caused redirect_uri_mismatch and
    the wrong-origin 404 after connecting.
    """
    explicit = os.environ.get("GOOGLE_CALENDAR_REDIRECT_URI")
    if explicit:
        return explicit
    backend = os.environ.get("BACKEND_URL")
    if backend:
        return f"{backend.rstrip('/')}/interviews/calendar/callback"
    return "http://localhost:7860/interviews/calendar/callback"


def is_configured() -> bool:
    return bool(os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET"))


# --- OAuth consent (recruiter connects their calendar) ---------------------

def build_calendar_auth_url(state: str) -> str:
    """URL of Google's consent screen for Calendar access.

    ``access_type=offline`` + ``prompt=consent`` guarantees Google returns a
    refresh token we can store and reuse to mint access tokens later.
    """
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": " ".join(CALENDAR_SCOPES),
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"


async def exchange_code_for_refresh_token(code: str) -> str:
    """Swap the consent ``code`` for a refresh token (raises if none returned)."""
    data = {
        "code": code,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri": _redirect_uri(),
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_ENDPOINT, data=data)
    resp.raise_for_status()
    payload = resp.json()
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise CalendarError(
            "Google did not return a refresh token. Re-consent with prompt=consent."
        )
    return refresh_token


def encrypt_refresh_token(refresh_token: str) -> str:
    """Encrypt a refresh token for storage on ``recruiter_profiles``."""
    return crypto.encrypt(refresh_token)


async def _access_token(encrypted_refresh_token: str) -> str:
    """Mint a short-lived access token from a stored (encrypted) refresh token.

    Access tokens are never persisted — they're fetched on demand and live only
    for the duration of one call, so there is no expiry to track on our side.
    Google returns a fresh one (valid ~1h) each time. If the refresh token has
    been revoked or expired, Google replies ``invalid_grant`` and we raise
    :class:`CalendarAuthError` so the caller can prompt the recruiter to
    reconnect.
    """
    refresh_token = crypto.decrypt(encrypted_refresh_token)
    if not refresh_token:
        raise CalendarAuthError("Stored refresh token could not be decrypted")
    data = {
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_ENDPOINT, data=data)
    if resp.status_code != 200:
        # Distinguish "you must reconnect" from a transient failure, without
        # logging the response body (it can echo token material).
        err = ""
        try:
            err = (resp.json() or {}).get("error", "")
        except ValueError:
            pass
        if resp.status_code in (400, 401) and err in ("invalid_grant", "unauthorized_client"):
            raise CalendarAuthError("Google authorization was revoked or expired; reconnect required")
        raise CalendarError(f"Token refresh failed (HTTP {resp.status_code})")
    return resp.json()["access_token"]


# --- Free/busy + event CRUD ------------------------------------------------

async def get_free_busy(
    encrypted_refresh_token: str,
    time_min: dt.datetime,
    time_max: dt.datetime,
) -> List[Tuple[dt.datetime, dt.datetime]]:
    """Return the recruiter's BUSY intervals between ``time_min`` and ``time_max``.

    Implemented via ``events.list`` (not the freeBusy endpoint) so the single
    ``calendar.events`` scope is sufficient — freeBusy would demand an extra read
    scope. Cancelled events and events marked *free* (``transparency=transparent``)
    are ignored. All-day events count as busy for their whole local day. Returned
    intervals are UTC-aware; the caller does interval-overlap math in UTC.
    """
    token = await _access_token(encrypted_refresh_token)
    params = {
        "timeMin": _iso(time_min),
        "timeMax": _iso(time_max),
        "singleEvents": "true",       # expand recurring events into instances
        "orderBy": "startTime",
        "maxResults": "2500",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            EVENTS_API, params=params, headers={"Authorization": f"Bearer {token}"}
        )
    if resp.status_code == 403:
        raise CalendarError(
            "Calendar access denied (403). Ensure the Google Calendar API is "
            "enabled and the recruiter re-connected with the calendar.events scope."
        )
    if resp.status_code != 200:
        raise CalendarError(f"events.list failed (HTTP {resp.status_code})")

    busy: List[Tuple[dt.datetime, dt.datetime]] = []
    for ev in resp.json().get("items", []):
        if ev.get("status") == "cancelled":
            continue
        if ev.get("transparency") == "transparent":  # "free" events don't block
            continue
        start, end = ev.get("start", {}), ev.get("end", {})
        if "dateTime" in start and "dateTime" in end:
            busy.append((_parse(start["dateTime"]), _parse(end["dateTime"])))
        elif "date" in start and "date" in end:
            # All-day event: [date 00:00, date 00:00) in the app timezone → UTC.
            tz = app_timezone()
            s = dt.datetime.fromisoformat(start["date"]).replace(tzinfo=tz)
            e = dt.datetime.fromisoformat(end["date"]).replace(tzinfo=tz)
            busy.append((s.astimezone(dt.timezone.utc), e.astimezone(dt.timezone.utc)))
    return busy


async def create_event(
    encrypted_refresh_token: str,
    *,
    summary: str,
    start: dt.datetime,
    end: dt.datetime,
    attendee_email: Optional[str] = None,
    description: Optional[str] = None,
) -> str:
    """Create a calendar event; returns the Google event id."""
    token = await _access_token(encrypted_refresh_token)
    tz = app_timezone_name()
    event = {
        "summary": summary,
        "description": description or "",
        "start": {"dateTime": _iso(start), "timeZone": tz},
        "end": {"dateTime": _iso(end), "timeZone": tz},
    }
    if attendee_email:
        event["attendees"] = [{"email": attendee_email}]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{EVENTS_API}?sendUpdates=all",
            json=event,
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code == 403:
        raise CalendarError(
            "create event denied (403): enable the Google Calendar API and ensure "
            "the calendar.events scope was granted."
        )
    if resp.status_code not in (200, 201):
        raise CalendarError(f"create event failed (HTTP {resp.status_code})")
    return resp.json()["id"]


async def update_event(
    encrypted_refresh_token: str,
    event_id: str,
    *,
    start: dt.datetime,
    end: dt.datetime,
) -> None:
    """Reschedule an existing event to a new start/end (PATCH)."""
    token = await _access_token(encrypted_refresh_token)
    tz = app_timezone_name()
    patch = {
        "start": {"dateTime": _iso(start), "timeZone": tz},
        "end": {"dateTime": _iso(end), "timeZone": tz},
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.patch(
            f"{EVENTS_API}/{event_id}?sendUpdates=all",
            json=patch,
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        raise CalendarError(f"update event failed (HTTP {resp.status_code})")


async def cancel_event(encrypted_refresh_token: str, event_id: str) -> None:
    """Delete an event from the recruiter's calendar (idempotent)."""
    token = await _access_token(encrypted_refresh_token)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{EVENTS_API}/{event_id}?sendUpdates=all",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code not in (200, 204, 410):  # 410 = already gone → idempotent
        raise CalendarError(f"cancel event failed (HTTP {resp.status_code})")


# --- helpers ---------------------------------------------------------------

def _iso(t: dt.datetime) -> str:
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return t.isoformat()


def _parse(s: str) -> dt.datetime:
    """Parse an RFC3339/ISO timestamp to a UTC-aware datetime.

    Google returns offset-aware strings (``...+10:00`` / ``...Z``). Normalise to
    UTC so all interval math downstream is naive-free and directly comparable.
    """
    parsed = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)
