"""Minimal in-process real-time event bus.

Module 4 must "broadcast a real-time update" when an application is parsed, but
the WebSocket/SSE presentation layer (Modules 6 & 12) isn't built yet. Rather
than couple agent code to a transport that doesn't exist, agents publish typed
events here and interested subscribers (the future ATS WebSocket hub, tests,
loggers) attach handlers. Today the only subscriber is a debug logger; wiring
the dashboard later is a one-line ``subscribe()`` call.

This is intentionally simple and in-process (single Uvicorn worker on the HF
Space). If we scale to multiple workers, swap the internals for Redis pub/sub
behind this same ``publish`` / ``subscribe`` API.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Dict, List

logger = logging.getLogger("recruitflow.events")

# Event type constants — keep string values stable; the frontend keys off them.
APPLICATION_UPDATED = "application.updated"
AGENT_RUN_COMPLETED = "agent_run.completed"


@dataclass
class Event:
    """A single broadcastable domain event."""

    type: str
    payload: Dict[str, Any] = field(default_factory=dict)


Subscriber = Callable[[Event], None]

_subscribers: List[Subscriber] = []


def subscribe(handler: Subscriber) -> Callable[[], None]:
    """Register ``handler`` for every published event. Returns an unsubscribe fn."""
    _subscribers.append(handler)

    def _unsubscribe() -> None:
        try:
            _subscribers.remove(handler)
        except ValueError:
            pass

    return _unsubscribe


def publish(event_type: str, **payload: Any) -> None:
    """Broadcast an event to all subscribers.

    Subscriber errors are swallowed and logged: a broken dashboard listener
    must never break the agent pipeline that produced the event.
    """
    event = Event(type=event_type, payload=payload)
    logger.debug("event %s %s", event.type, event.payload)
    for handler in list(_subscribers):
        try:
            handler(event)
        except Exception:  # noqa: BLE001
            logger.exception("event subscriber failed for %s", event.type)


def _debug_logger(event: Event) -> None:
    logger.info("[broadcast] %s %s", event.type, asdict(event)["payload"])


# Default subscriber so broadcasts are visible in logs until the WS hub exists.
subscribe(_debug_logger)
