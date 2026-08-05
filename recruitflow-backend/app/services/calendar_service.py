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
import os
from typing import List, Optional, Tuple
from urllib.parse import urlencode

import httpx

from app.core import crypto

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
FREEBUSY_API = f"{CALENDAR_API}/freeBusy"

# Read/write access to the recruiter's own calendar events.
CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"]


class CalendarError(Exception):
    """Raised when a Google Calendar operation fails."""


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
    # A calendar-specific callback; falls back to a conventional path.
    return os.environ.get(
        "GOOGLE_CALENDAR_REDIRECT_URI",
        os.environ.get("GOOGLE_REDIRECT_URI", "").replace(
            "/auth/google/callback", "/interviews/calendar/callback"
        ),
    )


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
    """Mint a short-lived access token from a stored (encrypted) refresh token."""
    refresh_token = crypto.decrypt(encrypted_refresh_token)
    if not refresh_token:
        raise CalendarError("Stored refresh token could not be decrypted")
    data = {
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_ENDPOINT, data=data)
    if resp.status_code != 200:
        raise CalendarError(f"Token refresh failed: {resp.text[:200]}")
    return resp.json()["access_token"]


# --- Free/busy + event CRUD ------------------------------------------------

async def get_free_busy(
    encrypted_refresh_token: str,
    time_min: dt.datetime,
    time_max: dt.datetime,
) -> List[Tuple[dt.datetime, dt.datetime]]:
    """Return the recruiter's BUSY intervals between ``time_min`` and ``time_max``.

    Times are serialised as UTC-aware ISO 8601. The caller subtracts these from
    the working-hours window to find free slots.
    """
    token = await _access_token(encrypted_refresh_token)
    body = {
        "timeMin": _iso(time_min),
        "timeMax": _iso(time_max),
        "items": [{"id": "primary"}],
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            FREEBUSY_API, json=body, headers={"Authorization": f"Bearer {token}"}
        )
    if resp.status_code != 200:
        raise CalendarError(f"freeBusy failed: {resp.text[:200]}")
    cals = resp.json().get("calendars", {})
    busy = cals.get("primary", {}).get("busy", [])
    return [(_parse(b["start"]), _parse(b["end"])) for b in busy]


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
    event = {
        "summary": summary,
        "description": description or "",
        "start": {"dateTime": _iso(start)},
        "end": {"dateTime": _iso(end)},
    }
    if attendee_email:
        event["attendees"] = [{"email": attendee_email}]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{CALENDAR_API}/calendars/primary/events?sendUpdates=all",
            json=event,
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code not in (200, 201):
        raise CalendarError(f"create event failed: {resp.text[:200]}")
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
    patch = {"start": {"dateTime": _iso(start)}, "end": {"dateTime": _iso(end)}}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.patch(
            f"{CALENDAR_API}/calendars/primary/events/{event_id}?sendUpdates=all",
            json=patch,
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        raise CalendarError(f"update event failed: {resp.text[:200]}")


async def cancel_event(encrypted_refresh_token: str, event_id: str) -> None:
    """Delete an event from the recruiter's calendar (idempotent)."""
    token = await _access_token(encrypted_refresh_token)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{CALENDAR_API}/calendars/primary/events/{event_id}?sendUpdates=all",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code not in (200, 204, 410):  # 410 = already gone → idempotent
        raise CalendarError(f"cancel event failed: {resp.text[:200]}")


# --- helpers ---------------------------------------------------------------

def _iso(t: dt.datetime) -> str:
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return t.isoformat()


def _parse(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
