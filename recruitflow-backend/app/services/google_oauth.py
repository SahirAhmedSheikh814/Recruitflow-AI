"""Google OAuth 2.0 helper for candidate "Continue with Google" login.

Implements the standard authorization-code flow:
  1. build_authorization_url() → redirect the browser to Google's consent screen
  2. Google redirects back to GOOGLE_REDIRECT_URI with a `code`
  3. exchange_code() → swap the code for tokens
  4. fetch_userinfo() → read the verified profile (sub, email, name)

Only used by the candidate login flow. Recruiters/admins use password auth.
Calendar OAuth (Module 8) is a separate consent flow with different scopes.
"""
import os
from typing import Optional
from urllib.parse import urlencode

import httpx

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

# Minimal scopes needed to identify the candidate.
SCOPES = ["openid", "email", "profile"]


def _client_id() -> str:
    cid = os.environ.get("GOOGLE_CLIENT_ID")
    if not cid:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured")
    return cid


def _client_secret() -> str:
    secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not secret:
        raise RuntimeError("GOOGLE_CLIENT_SECRET is not configured")
    return secret


def _redirect_uri() -> str:
    uri = os.environ.get("GOOGLE_REDIRECT_URI")
    if not uri:
        raise RuntimeError("GOOGLE_REDIRECT_URI is not configured")
    return uri


def is_configured() -> bool:
    return bool(
        os.environ.get("GOOGLE_CLIENT_ID")
        and os.environ.get("GOOGLE_CLIENT_SECRET")
        and os.environ.get("GOOGLE_REDIRECT_URI")
    )


def build_authorization_url(state: str) -> str:
    """URL of Google's consent screen. `state` is an opaque CSRF token we verify
    on callback."""
    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange the authorization code for Google's token response."""
    data = {
        "code": code,
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "redirect_uri": _redirect_uri(),
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(GOOGLE_TOKEN_ENDPOINT, data=data)
    resp.raise_for_status()
    return resp.json()


async def fetch_userinfo(access_token: str) -> dict:
    """Read the verified OpenID profile. Returns keys: sub, email, name,
    email_verified, ..."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    resp.raise_for_status()
    return resp.json()
