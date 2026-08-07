"""End-to-end double-booking rejection test on in-memory SQLite.

Proves the core requirement: with a slot already booked in OUR DB, a second
overlapping booking for the SAME recruiter is rejected, while a back-to-back
(non-overlapping) slot succeeds — with NO Google Calendar connected (busy=[]),
which is exactly the state that used to allow infinite double-booking.

Run: python scripts/verify_double_booking.py
"""
import asyncio
import datetime as dt
import os
import sys
import uuid

os.environ.setdefault("APP_TIMEZONE", "UTC")  # keep instants literal for the test
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine  # noqa: E402

from app.models.user import User, UserRole  # noqa: E402
from app.models.recruiter_profile import RecruiterProfile  # noqa: E402
from app.models.job import Job  # noqa: E402
from app.models.candidate import Candidate  # noqa: E402
from app.models.application import Application  # noqa: E402
from app.models.interview import Interview, InterviewStatus  # noqa: E402

# Shared in-memory SQLite across all Session(engine) calls in the module.
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SQLModel.metadata.create_all(test_engine)

# Point the scheduling agent's module-global engine at our test DB.
from app.agents import scheduling_agent as sa  # noqa: E402

sa.engine = test_engine

failures = []


def check(name, cond):
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
    if not cond:
        failures.append(name)


def seed():
    with Session(test_engine) as s:
        recruiter = User(role=UserRole.recruiter, email="rec@x.com", full_name="Rec")
        s.add(recruiter)
        s.commit()
        s.refresh(recruiter)
        # No google_refresh_token -> calendar dormant (the dangerous old state).
        s.add(RecruiterProfile(user_id=recruiter.id, working_hours_start="09:00", working_hours_end="17:00"))
        job = Job(recruiter_id=recruiter.id, title="Engineer", description="d")
        s.add(job)
        s.commit()
        s.refresh(job)
        cand = Candidate(full_name="A", email="a@x.com", source_channel="website")
        cand2 = Candidate(full_name="B", email="b@x.com", source_channel="website")
        s.add(cand)
        s.add(cand2)
        s.commit()
        s.refresh(cand)
        s.refresh(cand2)
        app1 = Application(candidate_id=cand.id, job_id=job.id)
        app2 = Application(candidate_id=cand2.id, job_id=job.id)
        s.add(app1)
        s.add(app2)
        s.commit()
        s.refresh(app1)
        s.refresh(app2)
        return app1.id, app2.id


async def main():
    app1_id, app2_id = seed()

    # Book app1 for 09:00-10:00 UTC via the deterministic path.
    r1 = await sa.book_preferred_slot(app1_id, "2026-08-10T09:00")  # Monday
    print("  book app1 09:00 ->", r1)
    check("app1 booked ok", r1.get("ok") is True)

    # app2 at 09:30 overlaps app1's 09:00-10:00 -> must be rejected as conflict.
    r2 = await sa.book_preferred_slot(app2_id, "2026-08-10T09:30")
    print("  book app2 09:30 ->", r2)
    check("app2 09:30 rejected (overlap, same recruiter)", r2.get("ok") is False)

    # app2 at 10:00 is back-to-back (non-overlapping) -> must succeed.
    r3 = await sa.book_preferred_slot(app2_id, "2026-08-10T10:00")
    print("  book app2 10:00 ->", r3)
    check("app2 10:00 booked ok (back-to-back allowed)", r3.get("ok") is True)

    # Weekend + past-time + outside-hours guards.
    r4 = await sa.book_preferred_slot(app1_id, "2026-08-08T09:00")  # Saturday
    check("weekend rejected", r4.get("ok") is False and "weekend" in r4.get("reason", "").lower())
    r5 = await sa.book_preferred_slot(app1_id, "2020-01-01T09:00")  # past
    check("past time rejected", r5.get("ok") is False)
    r6 = await sa.book_preferred_slot(app1_id, "2026-08-10T18:00")  # after 17:00
    check("outside working hours rejected", r6.get("ok") is False)

    # Exactly one active interview exists for app2 (the 10:00 one), none duplicated.
    with Session(test_engine) as s:
        ivs = s.query(Interview).all()
        active_starts = sorted(
            iv.scheduled_start for iv in ivs if iv.status in sa._ACTIVE_STATUSES
        )
    print("  active interview starts:", active_starts)
    check("exactly 2 active interviews (app1 09:00, app2 10:00)", len(active_starts) == 2)


asyncio.run(main())
print()
if failures:
    print(f"RESULT: {len(failures)} FAILED -> {failures}")
    sys.exit(1)
print("RESULT: ALL PASSED")
