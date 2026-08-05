"""Transactional email sending + branded templates (Module 10).

The Email Agent owns *deciding* which email to send; this service is the
mechanism. It provides:

  * ``render_template(email_type, context)`` — returns (subject, html) for one of
    the six branded templates (application confirmation, shortlisting, interview
    invitation, reminder, offer, rejection);
  * ``send_email(to, subject, html)`` — sends via SMTP (Resend/SendGrid/Gmail all
    speak SMTP), returning True/False.

Sending is **dormant until SMTP credentials are supplied** (SMTP_HOST/PORT/
USER/PASSWORD/EMAIL_FROM) — mirroring the IMAP and Forms workers. Until then
``is_configured()`` is False and ``send_email`` logs the intended message and
returns False, so the pipeline (status transitions, ``email_logs`` audit) still
runs end-to-end in development without a live mailbox.

Branding: primary colour #4A6CF7, Inter/Poppins headings, per the design system.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Tuple

logger = logging.getLogger("recruitflow.email")

BRAND = "RecruitFlow AI"
PRIMARY = "#4A6CF7"


def is_configured() -> bool:
    return bool(
        os.environ.get("SMTP_HOST")
        and os.environ.get("SMTP_USER")
        and os.environ.get("SMTP_PASSWORD")
    )


def _from_address() -> str:
    return os.environ.get("EMAIL_FROM") or os.environ.get("SMTP_USER") or "no-reply@recruitflow.ai"


def send_email(to: str, subject: str, html: str) -> bool:
    """Send one HTML email. Returns True on success, False if not sent.

    When SMTP isn't configured this is a no-op that logs the intended send and
    returns False, so callers can still record an ``email_logs`` row as failed.
    """
    if not to:
        logger.warning("send_email called with no recipient")
        return False
    if not is_configured():
        logger.info("[email dormant] would send to %s: %s", to, subject)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = _from_address()
    msg["To"] = to
    msg.attach(MIMEText(_strip_html(html), "plain"))
    msg.attach(MIMEText(html, "html"))

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASSWORD"]
    try:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(_from_address(), [to], msg.as_string())
        logger.info("sent '%s' email to %s", subject, to)
        return True
    except Exception:  # noqa: BLE001 — a send failure is recorded, never fatal
        logger.exception("failed to send email to %s", to)
        return False


# --- Branded templates -----------------------------------------------------

def _shell(heading: str, body_html: str) -> str:
    """Wrap body content in the branded HTML shell."""
    return f"""\
<!DOCTYPE html><html><body style="margin:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif;color:#1a1a2e;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:{PRIMARY};border-radius:12px 12px 0 0;padding:20px 28px;">
      <h1 style="margin:0;color:#fff;font-family:Poppins,Inter,Arial,sans-serif;font-size:20px;">{BRAND}</h1>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;">
      <h2 style="margin:0 0 16px;font-family:Poppins,Inter,Arial,sans-serif;font-size:18px;color:#1a1a2e;">{heading}</h2>
      {body_html}
      <p style="margin-top:28px;color:#8a8fa3;font-size:12px;">— The {BRAND} Team · TalentBridge Recruitment</p>
    </div>
  </div>
</body></html>"""


def render_template(email_type: str, context: Dict) -> Tuple[str, str]:
    """Return (subject, html) for the given email type.

    ``context`` keys used (all optional, defaulted): candidate_name, job_title,
    interview_datetime, interview_link, company_name.
    """
    name = context.get("candidate_name") or "there"
    job = context.get("job_title") or "the role"
    when = context.get("interview_datetime") or "the scheduled time"
    company = context.get("company_name") or "TalentBridge Recruitment"

    if email_type == "confirmation":
        subject = f"We received your application for {job}"
        body = (
            f"<p>Hi {name},</p><p>Thanks for applying for <strong>{job}</strong> at "
            f"{company}. Your application has been received and our AI screening is "
            f"underway. We'll be in touch with next steps shortly.</p>"
        )
    elif email_type == "shortlisted":
        subject = f"Good news about your application for {job}"
        body = (
            f"<p>Hi {name},</p><p>Great news — you've been <strong>shortlisted</strong> "
            f"for <strong>{job}</strong>. Our team will reach out to arrange an "
            f"interview soon.</p>"
        )
    elif email_type == "interview_invite":
        subject = f"Interview invitation — {job}"
        link = context.get("interview_link")
        link_html = (
            f'<p><a href="{link}" style="color:{PRIMARY};">Add to calendar / join</a></p>'
            if link else ""
        )
        body = (
            f"<p>Hi {name},</p><p>We'd like to invite you to an interview for "
            f"<strong>{job}</strong>.</p><p><strong>When:</strong> {when}</p>{link_html}"
            f"<p>Please reply to this email to <strong>confirm</strong>, or let us know "
            f"if you need to <strong>reschedule</strong>.</p>"
        )
    elif email_type == "reminder":
        subject = f"Reminder: your interview for {job} is tomorrow"
        body = (
            f"<p>Hi {name},</p><p>This is a friendly reminder that your interview for "
            f"<strong>{job}</strong> is scheduled for <strong>{when}</strong>. "
            f"We look forward to speaking with you.</p>"
        )
    elif email_type == "offer":
        subject = f"An offer for {job}"
        body = (
            f"<p>Hi {name},</p><p>Congratulations! Following your interview we're "
            f"delighted to move forward with an <strong>offer</strong> for "
            f"<strong>{job}</strong>. A formal offer letter will follow separately.</p>"
        )
    elif email_type == "rejection":
        subject = f"Update on your application for {job}"
        body = (
            f"<p>Hi {name},</p><p>Thank you for your interest in <strong>{job}</strong> "
            f"and for the time you invested in your application. After careful review we "
            f"won't be moving forward at this time. We wish you the very best and "
            f"encourage you to apply for future roles that match your skills.</p>"
        )
    else:
        subject = f"Update on your application for {job}"
        body = f"<p>Hi {name},</p><p>There's an update on your application for {job}.</p>"

    return subject, _shell(subject, body)


def _strip_html(html: str) -> str:
    """Very small HTML→text fallback for the plain-text MIME part."""
    import re

    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()
