"""IP-based fixed-window rate limiter for auth endpoints.

Keeps a per-IP list of request timestamps in memory. On each request it
drops timestamps older than the window, then rejects if the count is at or
above the limit. Thread-safe via a single lock (fine for a single-process
Uvicorn/Hugging Face Spaces deployment).
"""
import time
import threading
from collections import defaultdict

from fastapi import HTTPException, Request

_lock = threading.Lock()
_windows: dict[str, list[float]] = defaultdict(list)

_LIMIT = 5
_WINDOW = 60.0  # seconds


def check_auth_rate_limit(request: Request) -> None:
    """FastAPI dependency — raises 429 when the caller exceeds 5 req/min."""
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    cutoff = now - _WINDOW
    with _lock:
        _windows[ip] = [t for t in _windows[ip] if t > cutoff]
        if len(_windows[ip]) >= _LIMIT:
            raise HTTPException(429, "Too many requests — please wait a minute and try again")
        _windows[ip].append(now)
