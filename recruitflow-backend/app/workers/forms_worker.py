"""Google Forms intake channel — response poller.

Candidates apply through a Google Form that has a **file-upload** question for
their resume. Google stores the form's answers in the Forms API and puts each
uploaded file in the recruiter's Google Drive. This worker polls
``forms.responses.list`` for new submissions, downloads the uploaded resume from
Drive, and funnels it through :func:`app.services.intake_service.ingest_resume`
with ``source_channel=google_form``.

Job targeting: one Google Form maps to one job. Set ``GOOGLE_FORM_ID`` (the form
to poll) and ``GOOGLE_FORM_JOB_ID`` (the job those applications belong to).

Auth uses a Google **service account** with read access to the form and the
uploaded files, scoped to:
  https://www.googleapis.com/auth/forms.responses.readonly
  https://www.googleapis.com/auth/drive.readonly

Credentials (Module 11 — Google Forms/Sheets API), set in the environment:
  GOOGLE_FORM_ID                       — the form to poll
  GOOGLE_FORM_JOB_ID                   — job UUID applications are filed under
  GOOGLE_FORMS_SERVICE_ACCOUNT_FILE    — path to service-account JSON, OR
  GOOGLE_FORMS_SERVICE_ACCOUNT_JSON    — the service-account JSON inline

This module is import-safe without credentials — ``is_configured()`` gates all
network activity, so the app boots fine before the form is provisioned. The
google-api-python-client import is deferred into the polling path so the
dependency is only touched when the channel is actually used.
"""
import json
import os
import uuid
from dataclasses import dataclass
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

_SCOPES = [
    "https://www.googleapis.com/auth/forms.responses.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]

# Heuristics for locating the standard candidate fields among the form's
# free-text answers. Matched case-insensitively against each question's title.
_EMAIL_HINTS = ("email", "e-mail")
_NAME_HINTS = ("name", "full name")
_PHONE_HINTS = ("phone", "mobile", "contact number")
_LOCATION_HINTS = ("location", "city", "where are you")
_LINKEDIN_HINTS = ("linkedin",)
_PORTFOLIO_HINTS = ("portfolio", "website", "github")


def is_configured() -> bool:
    return bool(
        os.environ.get("GOOGLE_FORM_ID")
        and os.environ.get("GOOGLE_FORM_JOB_ID")
        and (
            os.environ.get("GOOGLE_FORMS_SERVICE_ACCOUNT_FILE")
            or os.environ.get("GOOGLE_FORMS_SERVICE_ACCOUNT_JSON")
        )
    )
@dataclass
class ParsedResponse:
    email: Optional[str]
    full_name: Optional[str]
    phone: Optional[str]
    current_location: Optional[str]
    linkedin_url: Optional[str]
    portfolio_url: Optional[str]
    resume_file_id: Optional[str]
    resume_filename: Optional[str]


def _credentials():
    """Build service-account credentials from env (inline JSON or file path)."""
    from google.oauth2 import service_account  # deferred import

    inline = os.environ.get("GOOGLE_FORMS_SERVICE_ACCOUNT_JSON")
    if inline:
        info = json.loads(inline)
        return service_account.Credentials.from_service_account_info(
            info, scopes=_SCOPES
        )
    path = os.environ["GOOGLE_FORMS_SERVICE_ACCOUNT_FILE"]
    return service_account.Credentials.from_service_account_file(path, scopes=_SCOPES)


def _question_index(forms_service, form_id: str) -> dict:
    """Map each questionId → its lowercased question title, so we can classify
    answers by what they're asking rather than by position."""
    form = forms_service.forms().get(formId=form_id).execute()
    index: dict = {}
    for item in form.get("items", []):
        question = item.get("questionItem", {}).get("question")
        if not question:
            continue
        qid = question.get("questionId")
        if qid:
            index[qid] = (item.get("title") or "").lower()
    return index


def _match(title: str, hints) -> bool:
    return any(h in title for h in hints)


def parse_response(answers: dict, question_titles: dict) -> ParsedResponse:
    """Turn one Forms API response's answers into a ParsedResponse by matching
    each answer's question title against the field hints."""
    parsed = ParsedResponse(
        email=None,
        full_name=None,
        phone=None,
        current_location=None,
        linkedin_url=None,
        portfolio_url=None,
        resume_file_id=None,
        resume_filename=None,
    )
    for qid, answer in answers.items():
        title = question_titles.get(qid, "")

        file_answers = answer.get("fileUploadAnswers")
        if file_answers:
            files = file_answers.get("answers", [])
            for f in files:
                filename = f.get("fileName") or ""
                if Path(filename).suffix.lower() in storage_service.ALLOWED_EXTENSIONS:
                    parsed.resume_file_id = f.get("fileId")
                    parsed.resume_filename = filename
                    break
            continue

        text_answers = answer.get("textAnswers", {}).get("answers", [])
        value = text_answers[0].get("value") if text_answers else None
        if not value:
            continue

        if parsed.email is None and _match(title, _EMAIL_HINTS):
            parsed.email = value.strip().lower()
        elif parsed.full_name is None and _match(title, _NAME_HINTS):
            parsed.full_name = value.strip()
        elif parsed.phone is None and _match(title, _PHONE_HINTS):
            parsed.phone = value.strip()
        elif parsed.current_location is None and _match(title, _LOCATION_HINTS):
            parsed.current_location = value.strip()
        elif parsed.linkedin_url is None and _match(title, _LINKEDIN_HINTS):
            parsed.linkedin_url = value.strip()
        elif parsed.portfolio_url is None and _match(title, _PORTFOLIO_HINTS):
            parsed.portfolio_url = value.strip()

    return parsed


def _download_drive_file(drive_service, file_id: str) -> bytes:
    import io

    from googleapiclient.http import MediaIoBaseDownload  # deferred import

    request = drive_service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return buffer.getvalue()


def _ingest_parsed(
    session: Session, drive_service, parsed: ParsedResponse, job_id: uuid.UUID
) -> bool:
    """Ingest one parsed form response. Returns True if handled (so it counts)."""
    if not parsed.resume_file_id or not parsed.resume_filename:
        print("[forms] skip: response has no PDF/DOCX resume upload")
        return False
    if not parsed.email:
        print("[forms] skip: response has no email answer")
        return False

    try:
        file_bytes = _download_drive_file(drive_service, parsed.resume_file_id)
    except Exception as exc:  # noqa: BLE001 — one bad file shouldn't stop the poll
        print(f"[forms] skip: could not download resume ({exc})")
        return False

    metadata = IntakeMetadata(
        job_id=job_id,
        email=parsed.email,
        source_channel=SourceChannel.google_form,
        full_name=parsed.full_name,
        phone=parsed.phone,
        current_location=parsed.current_location,
        linkedin_url=parsed.linkedin_url,
        portfolio_url=parsed.portfolio_url,
    )
    try:
        ingest_resume(session, file_bytes, parsed.resume_filename, metadata)
        print(f"[forms] ingested application from {parsed.email} for job {job_id}")
        return True
    except DuplicateApplication:
        print(f"[forms] duplicate: {parsed.email} already applied to {job_id}")
        return True  # already handled — not an error
    except IntakeError as exc:
        print(f"[forms] rejected ({exc.code}): {exc}")
        return False


def poll_once() -> int:
    """Poll the form once, ingesting every response carrying a resume. Returns
    the number of applications created. Safe no-op when the channel isn't
    configured. Dedup is handled downstream (one application per candidate per
    job), so re-seeing an already-ingested response is harmless."""
    if not is_configured():
        return 0

    from googleapiclient.discovery import build  # deferred import

    form_id = os.environ["GOOGLE_FORM_ID"]
    try:
        job_id = uuid.UUID(os.environ["GOOGLE_FORM_JOB_ID"])
    except ValueError:
        print("[forms] GOOGLE_FORM_JOB_ID is not a valid UUID — skipping poll")
        return 0

    creds = _credentials()
    forms_service = build("forms", "v1", credentials=creds, cache_discovery=False)
    drive_service = build("drive", "v3", credentials=creds, cache_discovery=False)

    question_titles = _question_index(forms_service, form_id)

    ingested = 0
    with Session(engine) as session:
        page_token = None
        while True:
            request = forms_service.forms().responses().list(
                formId=form_id, pageToken=page_token
            )
            result = request.execute()
            for response in result.get("responses", []):
                answers = response.get("answers", {})
                parsed = parse_response(answers, question_titles)
                if _ingest_parsed(session, drive_service, parsed, job_id):
                    ingested += 1
            page_token = result.get("nextPageToken")
            if not page_token:
                break
    return ingested
