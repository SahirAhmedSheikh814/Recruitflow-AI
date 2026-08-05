"""Intake channel scheduler.

Runs the credential-gated intake pollers (IMAP email/LinkedIn, Google Forms) on
a fixed interval from inside the FastAPI process. This keeps the deployment a
single Hugging Face Space container — no separate Celery worker or Redis broker
is needed just to poll for inbound resumes.

Each poller's own ``is_configured()`` gate means a channel stays dormant until
its credentials are provided, so this loop is safe to start unconditionally: it
simply does nothing for channels that aren't set up yet.

The pollers use blocking libraries (imaplib, google-api-python-client), so each
``poll_once()`` runs in a worker thread via ``run_in_executor`` to avoid
blocking the event loop.

Interval is configurable with ``INTAKE_POLL_INTERVAL_SECONDS`` (default 60).
Set ``INTAKE_POLLING_ENABLED=false`` to disable the loop entirely (e.g. when
running pollers from an external scheduler instead).
"""
import asyncio
import os
from typing import Optional

from app.workers import forms_worker, imap_worker, reminder_worker

_task: Optional["asyncio.Task"] = None


def _polling_enabled() -> bool:
    return os.environ.get("INTAKE_POLLING_ENABLED", "true").lower() != "false"


def _interval_seconds() -> int:
    try:
        return max(10, int(os.environ.get("INTAKE_POLL_INTERVAL_SECONDS", "60")))
    except ValueError:
        return 60


async def _run_poller(name: str, poll_once) -> None:
    """Run a single blocking poll_once() off the event loop, swallowing errors so
    one bad cycle never kills the loop."""
    loop = asyncio.get_running_loop()
    try:
        created = await loop.run_in_executor(None, poll_once)
        if created:
            print(f"[scheduler] {name}: {created} application(s) ingested")
    except Exception as exc:  # noqa: BLE001 — a transient failure shouldn't stop polling
        print(f"[scheduler] {name} poll failed: {exc}")


async def _loop() -> None:
    interval = _interval_seconds()
    print(f"[scheduler] intake polling every {interval}s")
    while True:
        await _run_poller("imap", imap_worker.poll_once)
        await _run_poller("forms", forms_worker.poll_once)
        await _run_poller("reminder", reminder_worker.poll_once)
        await asyncio.sleep(interval)


def start() -> None:
    """Start the background polling loop (idempotent). No-op if disabled."""
    global _task
    if not _polling_enabled():
        print("[scheduler] intake polling disabled (INTAKE_POLLING_ENABLED=false)")
        return
    if _task is not None and not _task.done():
        return
    _task = asyncio.create_task(_loop())


async def stop() -> None:
    """Cancel the polling loop on shutdown."""
    global _task
    if _task is None:
        return
    _task.cancel()
    try:
        await _task
    except asyncio.CancelledError:
        pass
    _task = None
