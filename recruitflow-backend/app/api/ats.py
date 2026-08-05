"""Internal ATS — real-time pipeline data layer (Module 12).

  * ``GET /ats/pipeline`` — the full joined application view (application +
    candidate + job) with search/filter by job, status, source channel, and
    score range. The recruiter/admin dashboards read this directly.
  * ``WS /ats/ws`` — a live channel. It subscribes to the in-process event bus
    (:mod:`app.services.events`) and forwards every domain event to connected
    clients, so dashboards update in real time as agents advance applications.

The event bus is synchronous and may publish from background agent threads, so
the WebSocket bridges events onto an ``asyncio.Queue`` via the running loop in a
thread-safe way.
"""
import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from app.core.deps import require_role
from app.db.session import get_session
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import UserRole
from app.services import events, storage_service

router = APIRouter()


def _row(app: Application, candidate: Optional[Candidate], job: Optional[Job]) -> dict:
    return {
        "id": str(app.id),
        "status": app.status,
        "score": app.score,
        "classification": app.classification,
        "score_explanation": app.score_explanation,
        "created_at": app.created_at,
        "updated_at": app.updated_at,
        "candidate": {
            "id": str(candidate.id) if candidate else None,
            "full_name": candidate.full_name if candidate else None,
            "email": candidate.email if candidate else None,
            "source_channel": candidate.source_channel if candidate else None,
            "resume_download_url": storage_service.public_url(candidate.resume_file_url)
            if candidate and candidate.resume_file_url
            else None,
            "parsed_data": candidate.parsed_data if candidate else None,
        }
        if candidate
        else None,
        "job": {"id": str(job.id), "title": job.title} if job else None,
    }


@router.get("/pipeline")
def pipeline(
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    source_channel: Optional[str] = None,
    min_score: Optional[int] = None,
    max_score: Optional[int] = None,
    user=Depends(require_role(UserRole.recruiter, UserRole.admin)),
    session: Session = Depends(get_session),
):
    """Full joined application data for the ATS board, with filters."""
    query = select(Application)
    if job_id:
        query = query.where(Application.job_id == uuid.UUID(job_id))
    if status:
        query = query.where(Application.status == status)
    if min_score is not None:
        query = query.where(Application.score >= min_score)
    if max_score is not None:
        query = query.where(Application.score <= max_score)

    rows = []
    for app in session.exec(query).all():
        candidate = session.get(Candidate, app.candidate_id)
        if source_channel and (not candidate or candidate.source_channel != source_channel):
            continue
        job = session.get(Job, app.job_id)
        rows.append(_row(app, candidate, job))
    rows.sort(key=lambda r: r["updated_at"], reverse=True)
    return rows


@router.websocket("/ws")
async def ats_ws(websocket: WebSocket):
    """Live ATS updates. Forwards every event-bus event to the client."""
    await websocket.accept()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def _on_event(event: events.Event) -> None:
        # publish() may run on a background agent thread → hop to the loop safely.
        loop.call_soon_threadsafe(queue.put_nowait, {"type": event.type, "payload": event.payload})

    unsubscribe = events.subscribe(_on_event)
    try:
        while True:
            message = await queue.get()
            await websocket.send_json(message)
    except WebSocketDisconnect:
        pass
    finally:
        unsubscribe()
