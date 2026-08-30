"""Riva chat API (candidate-only).

Four routes, all locked to the signed-in candidate via ``require_role``:

  GET    /riva/conversation  — the candidate's rolling conversation + transcript
  POST   /riva/messages      — send a message, get Riva's reply (+ a submission
                               handoff object when the draft is ready)
  POST   /riva/outcome       — the browser reports the result of the actual
                               application submission so Riva can acknowledge it
  DELETE /riva/conversation  — clear the conversation and start over

Riva NEVER creates an application here. When a turn marks the draft ready, this
router returns a ``submission`` object ``{job_id, full_name, email}`` and the
browser calls the existing ``POST /applications`` endpoint with the candidate's
own cookie and the résumé file it is holding. There is no file-upload route on
Riva, by design.
"""
from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from threading import Lock
from typing import Deque, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.agents.riva_runner import run_riva_turn
from app.core.deps import require_role
from app.db.session import get_session
from app.models.chat import ChatConversation, ChatMessage, ChatRole
from app.models.user import User, UserRole

router = APIRouter()

# Cap message length to keep prompts and storage bounded.
_MAX_CONTENT_CHARS = 4000

# ── Per-user fixed-window rate limit ──────────────────────────────────────────
# A small local limiter (the shared auth limiter in core/rate_limit.py is IP-based
# and not meant to be edited for this). Keyed by user id so one chatty candidate
# cannot exhaust the LLM budget: at most _RL_LIMIT turns per _RL_WINDOW seconds.
_RL_LIMIT = 20
_RL_WINDOW = 60.0
_rl_hits: Dict[uuid.UUID, Deque[float]] = defaultdict(deque)
_rl_lock = Lock()


def _check_rate_limit(user_id: uuid.UUID) -> None:
    now = time.monotonic()
    with _rl_lock:
        hits = _rl_hits[user_id]
        while hits and now - hits[0] > _RL_WINDOW:
            hits.popleft()
        if len(hits) >= _RL_LIMIT:
            raise HTTPException(429, "You're sending messages too fast. Please wait a moment.")
        hits.append(now)


# ── Schemas ───────────────────────────────────────────────────────────────────

class MessageIn(BaseModel):
    content: str
    # Filename of a résumé the candidate has attached in the browser this turn.
    # The file itself is NOT sent here — it stays in browser memory and is posted
    # to POST /applications only when the draft is submitted.
    resume_filename: Optional[str] = None


class OutcomeIn(BaseModel):
    success: bool
    application_id: Optional[str] = None
    error: Optional[str] = None


def _msg_out(msg: ChatMessage) -> dict:
    return {
        "id": str(msg.id),
        "role": msg.role.value,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
    }


def _get_or_create_conversation(session: Session, user_id: uuid.UUID) -> ChatConversation:
    convo = session.exec(
        select(ChatConversation).where(ChatConversation.user_id == user_id)
    ).first()
    if convo is None:
        convo = ChatConversation(user_id=user_id, draft={})
        session.add(convo)
        session.commit()
        session.refresh(convo)
    return convo


def _load_messages(session: Session, conversation_id: uuid.UUID) -> list[ChatMessage]:
    return list(
        session.exec(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.created_at)
        ).all()
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/conversation")
def get_conversation(
    current_user: User = Depends(require_role(UserRole.candidate)),
    session: Session = Depends(get_session),
):
    """Return the candidate's conversation and its full transcript."""
    convo = _get_or_create_conversation(session, current_user.id)
    messages = _load_messages(session, convo.id)
    return {
        "conversation_id": str(convo.id),
        "messages": [_msg_out(m) for m in messages],
    }


@router.post("/messages")
async def post_message(
    body: MessageIn,
    current_user: User = Depends(require_role(UserRole.candidate)),
    session: Session = Depends(get_session),
):
    """Send one message to Riva and return her reply.

    When the turn marks the draft ready to submit, the response includes a
    ``submission`` object the browser uses to call the existing applications
    endpoint. This route never creates an application itself.
    """
    _check_rate_limit(current_user.id)

    content = (body.content or "").strip()
    if not content:
        raise HTTPException(400, "Message cannot be empty.")
    content = content[:_MAX_CONTENT_CHARS]

    convo = _get_or_create_conversation(session, current_user.id)

    # If a résumé is attached in the browser this turn, record that on the draft
    # so Riva's tools know a file is present (the bytes never reach the backend
    # here — they go straight to POST /applications at submit time).
    if body.resume_filename:
        draft = dict(convo.draft) if convo.draft else {}
        draft["resume_attached"] = True
        draft["resume_filename"] = body.resume_filename[:255]
        convo.draft = draft
        session.add(convo)
        session.commit()

    # Persist the user's message, then rebuild the transcript for context.
    user_msg = ChatMessage(
        conversation_id=convo.id, role=ChatRole.user, content=content
    )
    session.add(user_msg)
    session.commit()
    session.refresh(user_msg)

    history = [
        {"role": m.role.value, "content": m.content}
        for m in _load_messages(session, convo.id)
    ]

    result = await run_riva_turn(
        user_id=current_user.id,
        conversation_id=convo.id,
        email=current_user.email,
        full_name=current_user.full_name,
        history=history,
    )

    assistant_msg = ChatMessage(
        conversation_id=convo.id,
        role=ChatRole.assistant,
        content=result.assistant_text,
    )
    session.add(assistant_msg)
    session.commit()
    session.refresh(assistant_msg)

    response: dict = {
        "user_message": _msg_out(user_msg),
        "assistant_message": _msg_out(assistant_msg),
    }

    # If the draft was marked ready this turn, hand the browser exactly the fields
    # the existing POST /applications form needs. The résumé File is supplied by
    # the browser, not here.
    if result.ready_to_submit:
        session.refresh(convo)
        draft = convo.draft or {}
        if draft.get("ready") and draft.get("job_id") and draft.get("full_name"):
            response["submission"] = {
                "job_id": draft["job_id"],
                "full_name": draft["full_name"],
                "email": draft.get("email") or current_user.email,
                "job_title": draft.get("job_title"),
            }

    return response


@router.post("/outcome")
def report_outcome(
    body: OutcomeIn,
    current_user: User = Depends(require_role(UserRole.candidate)),
    session: Session = Depends(get_session),
):
    """The browser reports the result of the actual application submission.

    On success the draft is reset (so a fresh application can be started) and Riva
    posts a confirmation; on failure the ``ready`` flag is cleared so the candidate
    can retry, and Riva posts the error. Returns the appended assistant message.
    """
    convo = _get_or_create_conversation(session, current_user.id)

    if body.success:
        note = (
            "🎉 Your application has been submitted successfully! You can track its "
            "status any time from **My Applications**. Is there anything else I can "
            "help you with?"
        )
        convo.draft = {}
    else:
        detail = (body.error or "").strip()
        note = (
            "I couldn't complete the submission"
            + (f" — {detail}" if detail else "")
            + ". Your details are saved, so we can try again. Would you like to?"
        )
        draft = dict(convo.draft) if convo.draft else {}
        draft.pop("ready", None)
        convo.draft = draft

    session.add(convo)
    session.commit()

    assistant_msg = ChatMessage(
        conversation_id=convo.id, role=ChatRole.assistant, content=note
    )
    session.add(assistant_msg)
    session.commit()
    session.refresh(assistant_msg)

    return {"assistant_message": _msg_out(assistant_msg)}


@router.delete("/conversation", status_code=204)
def clear_conversation(
    current_user: User = Depends(require_role(UserRole.candidate)),
    session: Session = Depends(get_session),
):
    """Delete the candidate's conversation transcript and draft (start over)."""
    convo = session.exec(
        select(ChatConversation).where(ChatConversation.user_id == current_user.id)
    ).first()
    if convo is not None:
        for msg in _load_messages(session, convo.id):
            session.delete(msg)
        session.delete(convo)
        session.commit()
    return None
