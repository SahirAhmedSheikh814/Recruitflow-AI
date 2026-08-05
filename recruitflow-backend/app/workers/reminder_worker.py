"""Interview reminder worker (Module 9).

Sends a "your interview is tomorrow" email ~24 hours before each confirmed or
proposed interview. Runs on the same in-process interval scheduler as the intake
pollers — no external Celery/Redis broker needed for the single HF Space
container.

Idempotency: a reminder is sent at most once per interview. We treat the
presence of a ``reminder`` row in ``email_logs`` for the application as "already
reminded", so re-polling never double-sends.

The actual email goes out through the Email Agent pipeline (``run_email_bg``),
so it uses the same branded template and logging as every other transactional
email. If SMTP isn't configured yet the Email Agent's ``send_email`` degrades to
a dormant no-op, so this loop is safe to run before email creds are supplied.
"""
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.db.session import engine
from app.models.application import Application
from app.models.email_log import EmailLog, EmailType
from app.models.interview import Interview, InterviewStatus

# Fire reminders for interviews starting within this window from now.
_REMINDER_LEAD = timedelta(hours=24)
# Statuses that still warrant a reminder (not cancelled/completed).
_ACTIVE_STATUSES = {
    InterviewStatus.proposed,
    InterviewStatus.confirmed,
    InterviewStatus.rescheduled,
}


def _already_reminded(session: Session, application_id) -> bool:
    return (
        session.exec(
            select(EmailLog).where(
                EmailLog.application_id == application_id,
                EmailLog.type == EmailType.reminder,
            )
        ).first()
        is not None
    )


def poll_once() -> int:
    """Send reminders for interviews starting within the next 24h. Returns the
    number of reminders dispatched. Safe to call repeatedly."""
    from app.agents.runner import run_email_bg  # lazy — avoids import cycle

    now = datetime.utcnow()
    cutoff = now + _REMINDER_LEAD

    sent = 0
    with Session(engine) as session:
        interviews = session.exec(
            select(Interview).where(
                Interview.scheduled_start.is_not(None),
                Interview.scheduled_start > now,
                Interview.scheduled_start <= cutoff,
                Interview.status.in_(_ACTIVE_STATUSES),
            )
        ).all()

        for iv in interviews:
            if _already_reminded(session, iv.application_id):
                continue
            application = session.get(Application, iv.application_id)
            if application is None:
                continue
            run_email_bg(iv.application_id, "reminder")
            sent += 1
            print(f"[reminder] queued reminder for application {iv.application_id}")

    return sent
