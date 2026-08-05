"""Symmetric encryption for secrets stored at rest (Fernet / AES-128-CBC+HMAC).

Used to encrypt long-lived Google refresh tokens before they go into
``recruiter_profiles.google_refresh_token`` (Module 8 requires OAuth tokens
encrypted at rest). Rather than introduce a new credential, the Fernet key is
deterministically derived from the existing ``JWT_SECRET`` env var, so there is
exactly one root secret to manage per environment.

If ``JWT_SECRET`` ever rotates, previously stored tokens can no longer be
decrypted — recruiters simply reconnect their calendar, which is an acceptable
and safe failure mode.
"""
from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set — cannot derive encryption key")
    # Fernet needs a 32-byte urlsafe-base64 key; derive it stably from JWT_SECRET.
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    """Encrypt a UTF-8 string, returning a urlsafe token string."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(token: str) -> str | None:
    """Decrypt a token produced by :func:`encrypt`; ``None`` if it can't be read."""
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None
