"""Email intake channel — IMAP inbox poller.

Polls an IMAP mailbox for unread messages carrying a resume attachment
(PDF/DOCX) and funnels each through :func:`app.services.intake_service.ingest_resume`
with ``source_channel=email`` (or ``linkedin`` when the message is a LinkedIn
job-application forward).

Job targeting: candidates apply by email to a specific role by including a job
tag in the subject line — ``[JOB:<uuid>]``. Messages without a resolvable job
tag are left unread and logged, so nothing is silently dropped.

Credentials (Module 3 / Module 11 shared mailbox), set in the environment:
  IMAP_HOST, IMAP_PORT (default 993), IMAP_USER, IMAP_PASSWORD
  IMAP_MAILBOX (default "INBOX")

This module is import-safe without credentials — ``is_configured()`` gates all
network activity, so the app boots fine before the mailbox is provisioned.
"""
import email
import imaplib
import os
import re
import uuid
from dataclasses import dataclass
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parseaddr
from pathlib import Path
from typing import Optional

from sqlmodel import Session

from app.db.session import engine
from app.models.candidate import SourceChannel
from app.services import storage_service
from app.services.intake_service import (
    ingest_resume,
    IntakeMetadata,
    IntakeError,
    DuplicateApplication,
)

_JOB_TAG_RE = re.compile(r"\[JOB:([0-9a-fA-F-]{36})\]")
_LINKEDIN_SENDERS = ("linkedin.com", "jobs-noreply@linkedin.com")


def is_configured() -> bool:
    return bool(
        os.environ.get("IMAP_HOST")
        and os.environ.get("IMAP_USER")
        and os.environ.get("IMAP_PASSWORD")
    )


@dataclass
class ParsedEmail:
    sender_email: str
    sender_name: Optional[str]
    subject: str
    job_id: Optional[uuid.UUID]
    attachment_filename: Optional[str]
    attachment_bytes: Optional[bytes]
    is_linkedin: bool


def _decode(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:  # noqa: BLE001 — malformed headers shouldn't crash the poll
        return value


def _extract_job_id(subject: str) -> Optional[uuid.UUID]:
    match = _JOB_TAG_RE.search(subject or "")
    if not match:
        return None
    try:
        return uuid.UUID(match.group(1))
    except ValueError:
        return None


def _first_resume_attachment(msg: Message):
    """Return (filename, bytes) of the first PDF/DOCX attachment, or (None, None)."""
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        filename = _decode(part.get_filename())
        if not filename:
            continue
        if Path(filename).suffix.lower() in storage_service.ALLOWED_EXTENSIONS:
            payload = part.get_payload(decode=True)
            if payload:
                return filename, payload
    return None, None


def parse_message(raw: bytes) -> ParsedEmail:
    msg = email.message_from_bytes(raw)
    from_name, from_addr = parseaddr(_decode(msg.get("From")))
    subject = _decode(msg.get("Subject"))
    filename, data = _first_resume_attachment(msg)
    is_linkedin = any(s in (from_addr or "").lower() for s in _LINKEDIN_SENDERS)
    return ParsedEmail(
        sender_email=(from_addr or "").lower(),
        sender_name=from_name or None,
        subject=subject,
        job_id=_extract_job_id(subject),
        attachment_filename=filename,
        attachment_bytes=data,
        is_linkedin=is_linkedin,
    )


def _ingest_parsed(session: Session, parsed: ParsedEmail) -> bool:
    """Attempt to ingest one parsed email. Returns True if an application was
    created (so the caller can mark the message seen)."""
    if not parsed.attachment_bytes or not parsed.attachment_filename:
        print(f"[imap] skip: no resume attachment (from={parsed.sender_email})")
        return False
    if not parsed.job_id:
        print(f"[imap] skip: no [JOB:<uuid>] tag in subject (from={parsed.sender_email})")
        return False
    if not parsed.sender_email:
        print("[imap] skip: no sender address")
        return False

    metadata = IntakeMetadata(
        job_id=parsed.job_id,
        email=parsed.sender_email,
        source_channel=SourceChannel.linkedin if parsed.is_linkedin else SourceChannel.email,
        full_name=parsed.sender_name,
    )
    try:
        ingest_resume(session, parsed.attachment_bytes, parsed.attachment_filename, metadata)
        print(f"[imap] ingested application from {parsed.sender_email} for job {parsed.job_id}")
        return True
    except DuplicateApplication:
        print(f"[imap] duplicate: {parsed.sender_email} already applied to {parsed.job_id}")
        return True  # already handled — mark seen so we don't re-poll it forever
    except IntakeError as exc:
        print(f"[imap] rejected ({exc.code}): {exc}")
        return False


def poll_once() -> int:
    """Poll the mailbox once, ingesting every unread resume email. Returns the
    number of applications created. Safe no-op when IMAP isn't configured."""
    if not is_configured():
        return 0

    host = os.environ["IMAP_HOST"]
    port = int(os.environ.get("IMAP_PORT", "993"))
    user = os.environ["IMAP_USER"]
    password = os.environ["IMAP_PASSWORD"]
    mailbox = os.environ.get("IMAP_MAILBOX", "INBOX")

    ingested = 0
    conn = imaplib.IMAP4_SSL(host, port)
    try:
        conn.login(user, password)
        conn.select(mailbox)
        status, data = conn.search(None, "UNSEEN")
        if status != "OK":
            return 0
        msg_ids = data[0].split()
        with Session(engine) as session:
            for msg_id in msg_ids:
                fetch_status, fetch_data = conn.fetch(msg_id, "(RFC822)")
                if fetch_status != "OK" or not fetch_data or not fetch_data[0]:
                    continue
                raw = fetch_data[0][1]
                parsed = parse_message(raw)
                if _ingest_parsed(session, parsed):
                    ingested += 1
                    conn.store(msg_id, "+FLAGS", "\\Seen")
    finally:
        try:
            conn.logout()
        except Exception:  # noqa: BLE001
            pass
    return ingested
