"""Channel-agnostic resume intake.

Every intake channel — the website apply form, the IMAP email worker, the
Google Forms poller, LinkedIn (via email) — funnels through the single
``ingest_resume(file_bytes, filename, metadata)`` function. It is the one place
that:

  1. validates the file type (PDF/DOCX only),
  2. stores the raw file via :mod:`app.services.storage_service`,
  3. finds-or-creates the candidate and their application row,
  4. records the ``source_channel`` the resume arrived through,
  5. hands off to the Orchestrator Agent (parse → score), which is triggered
     as a background task — never inline — so intake stays fast.

Keeping this in one function means all channels get identical validation,
de-duplication, and downstream behaviour for free.
"""
import uuid
from dataclasses import dataclass, field
from typing import Optional

from sqlmodel import Session, select

from app.models.application import Application, ApplicationStatus
from app.models.candidate import Candidate, SourceChannel
from app.models.job import Job, JobStatus
from app.services import storage_service

ALLOWED_EXTENSIONS = storage_service.ALLOWED_EXTENSIONS


class IntakeError(Exception):
    """Raised when a resume cannot be ingested (bad file, closed job, dup)."""

    def __init__(self, message: str, *, code: str = "intake_error"):
        super().__init__(message)
        self.code = code


class DuplicateApplication(IntakeError):
    """The candidate already applied for this job."""

    def __init__(self, message: str = "An application already exists for this job"):
        super().__init__(message, code="duplicate")


@dataclass
class IntakeMetadata:
    """Everything a channel knows about an incoming resume besides the file."""

    job_id: uuid.UUID
    email: str
    source_channel: SourceChannel
    full_name: Optional[str] = None
    phone: Optional[str] = None
    current_location: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    user_id: Optional[uuid.UUID] = None  # set when a logged-in candidate applies
    content_type: Optional[str] = None  # client-declared MIME, when a channel has it


@dataclass
class IntakeResult:
    candidate: Candidate
    application: Application
    created_candidate: bool
    created_application: bool
    storage_key: str


def _validate_filetype(filename: str) -> None:
    from pathlib import Path

    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise IntakeError(
            "Resume must be a PDF or DOCX file", code="invalid_filetype"
        )


def ingest_resume(
    session: Session,
    file_bytes: bytes,
    filename: str,
    metadata: IntakeMetadata,
    *,
    trigger_processing: bool = True,
) -> IntakeResult:
    """Store a resume and create the candidate + application records.

    Shared by every intake channel. Raises :class:`IntakeError` (or its
    :class:`DuplicateApplication` subclass) on any rejection so callers can map
    to the right HTTP status / log line.
    """
    _validate_filetype(filename)

    # Normalize the email so the same person is one candidate regardless of the
    # casing/whitespace a channel happened to capture — this is what makes
    # de-duplication reliable across every intake channel.
    email = (metadata.email or "").strip().lower()
    if not email:
        raise IntakeError("An email address is required", code="missing_email")

    # The job must exist and be open to new applications.
    job = session.get(Job, metadata.job_id)
    if not job or job.status != JobStatus.open:
        raise IntakeError(
            "Job not found or not accepting applications", code="job_unavailable"
        )

    # Find-or-create the candidate by email (one candidate, many applications).
    candidate = session.exec(
        select(Candidate).where(Candidate.email == email)
    ).first()
    created_candidate = candidate is None

    # Reject duplicates *before* storing the file or mutating the candidate, so a
    # repeat submission never orphans an uploaded file or overwrites good data.
    if candidate is not None:
        existing = session.exec(
            select(Application).where(
                Application.candidate_id == candidate.id,
                Application.job_id == job.id,
            )
        ).first()
        if existing:
            raise DuplicateApplication()

    # Persist the raw file; the key goes on the candidate row. store_resume
    # runs the shared server-side validation (size ≤ 10MB, PDF/DOCX only, magic
    # bytes) — re-raise its StorageError as an IntakeError, preserving the code
    # so callers can still map file_too_large → 413 and invalid_filetype → 400.
    try:
        storage_key = storage_service.store_resume(
            file_bytes, filename, metadata.content_type
        )
    except storage_service.StorageError as exc:
        raise IntakeError(str(exc), code=exc.code) from exc

    if candidate is None:
        candidate = Candidate(
            user_id=metadata.user_id,
            full_name=metadata.full_name or email.split("@")[0],
            email=email,
            phone=metadata.phone,
            current_location=metadata.current_location,
            linkedin_url=metadata.linkedin_url,
            portfolio_url=metadata.portfolio_url,
            resume_file_url=storage_key,
            source_channel=metadata.source_channel,
        )
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
    else:
        # Refresh the stored resume and any newly supplied profile fields.
        candidate.resume_file_url = storage_key
        if metadata.user_id and not candidate.user_id:
            candidate.user_id = metadata.user_id
        if metadata.full_name:
            candidate.full_name = metadata.full_name
        if metadata.phone:
            candidate.phone = metadata.phone
        if metadata.current_location:
            candidate.current_location = metadata.current_location
        if metadata.linkedin_url:
            candidate.linkedin_url = metadata.linkedin_url
        if metadata.portfolio_url:
            candidate.portfolio_url = metadata.portfolio_url
        session.add(candidate)
        session.commit()
        session.refresh(candidate)

    application = Application(
        candidate_id=candidate.id,
        job_id=job.id,
        status=ApplicationStatus.received,
    )
    session.add(application)
    session.commit()
    session.refresh(application)

    if trigger_processing:
        _handoff_to_orchestrator(application.id)

    return IntakeResult(
        candidate=candidate,
        application=application,
        created_candidate=created_candidate,
        created_application=True,
        storage_key=storage_key,
    )


def _handoff_to_orchestrator(application_id: uuid.UUID) -> None:
    """Kick off downstream parse → score processing.

    Launches the Orchestrator Agent run (resume → Resume Parser Agent) as a
    non-blocking background task, so intake stays fast and never runs agents
    inline. The runner owns status transition, ``agent_runs`` logging, and the
    real-time broadcast.
    """
    # Imported lazily so importing intake doesn't pull in the whole agents/LLM
    # stack (and so a missing OPENROUTER_API_KEY can't break plain intake).
    from app.agents.runner import run_resume_pipeline_bg

    run_resume_pipeline_bg(application_id)
