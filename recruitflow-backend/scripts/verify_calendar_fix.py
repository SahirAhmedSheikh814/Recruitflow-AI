"""Ad-hoc verification for the Google Calendar / scheduling fix.

Run: python scripts/verify_calendar_fix.py
Exercises the pure logic (no network, no DB writes) that underpins the
double-booking prevention and timezone handling.
"""
import datetime as dt
import os
import sys

# Force a real business timezone for the interpretation test BEFORE imports read it.
os.environ.setdefault("APP_TIMEZONE", "Australia/Sydney")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import calendar_service as cs  # noqa: E402
from app.agents import scheduling_agent as sa  # noqa: E402

failures = []


def check(name, cond):
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}")
    if not cond:
        failures.append(name)


print("1) imports")
check("calendar_service imported", cs is not None)
check("scheduling_agent imported", sa is not None)
check("CalendarAuthError is a CalendarError", issubclass(cs.CalendarAuthError, cs.CalendarError))

print("2) scopes are minimal (calendar.events, not broad calendar/readonly)")
check("calendar.events requested", "https://www.googleapis.com/auth/calendar.events" in cs.CALENDAR_SCOPES)
check("no broad calendar scope", "https://www.googleapis.com/auth/calendar" not in cs.CALENDAR_SCOPES)
check("no readonly scope", "https://www.googleapis.com/auth/calendar.readonly" not in cs.CALENDAR_SCOPES)

print("3) overlap logic — 09:00-10:00 booked (user's exact examples)")
base = dt.datetime(2026, 8, 10, 9, 0, tzinfo=dt.timezone.utc)  # a Monday
booked_s = base
booked_e = base + dt.timedelta(hours=1)  # 09:00–10:00


def ov(sh, sm, eh, em):
    s = dt.datetime(2026, 8, 10, sh, sm, tzinfo=dt.timezone.utc)
    e = dt.datetime(2026, 8, 10, eh, em, tzinfo=dt.timezone.utc)
    return sa._overlaps(s, e, booked_s, booked_e)


check("09:00-09:30 blocked", ov(9, 0, 9, 30) is True)
check("09:15-09:45 blocked", ov(9, 15, 9, 45) is True)
check("09:30-10:00 blocked", ov(9, 30, 10, 0) is True)
check("09:45-10:15 blocked", ov(9, 45, 10, 15) is True)
check("10:00-10:30 ALLOWED (back-to-back)", ov(10, 0, 10, 30) is False)
check("08:30-09:00 ALLOWED (ends as booking starts)", ov(8, 30, 9, 0) is False)
check("08:00-08:30 ALLOWED (fully before)", ov(8, 0, 8, 30) is False)

print("4) timezone interpretation — naive picker time anchored to APP_TIMEZONE, not UTC")
tzname = cs.app_timezone_name()
print(f"     APP_TIMEZONE resolved to: {tzname}")
# 09:00 wall-clock in Sydney on 2026-08-10 (AEST, UTC+10) == 23:00 UTC on 2026-08-09.
parsed = sa._parse_preferred("2026-08-10T09:00")
check("parsed is tz-aware UTC", parsed.tzinfo is not None)
if tzname == "Australia/Sydney":
    check(
        "09:00 Sydney -> 23:00Z prev day (NOT stamped 09:00Z)",
        parsed == dt.datetime(2026, 8, 9, 23, 0, tzinfo=dt.timezone.utc),
    )
    check("naive-UTC bug avoided", parsed.hour != 9)
else:
    print("     (skipped Sydney-specific assertion; tzdata may be missing)")

print("5) offset-carrying input is honoured as-is")
parsed2 = sa._parse_preferred("2026-08-10T09:00+00:00")
check("explicit +00:00 -> 09:00Z", parsed2 == dt.datetime(2026, 8, 10, 9, 0, tzinfo=dt.timezone.utc))

print("6) _db_to_utc — naive stored value read back as UTC-aware")
naive = dt.datetime(2026, 8, 10, 9, 0)
check("_db_to_utc stamps UTC", sa._db_to_utc(naive) == dt.datetime(2026, 8, 10, 9, 0, tzinfo=dt.timezone.utc))

print("7) advisory lock is dialect-guarded (no-op off Postgres)")


class _FakeDialect:
    name = "sqlite"


class _FakeBind:
    dialect = _FakeDialect()


class _FakeSession:
    bind = _FakeBind()

    def exec(self, *a, **k):  # must NOT be called on sqlite
        raise AssertionError("pg_advisory_xact_lock attempted on non-postgres bind")


import uuid as _uuid  # noqa: E402

try:
    sa._advisory_lock(_FakeSession(), _uuid.uuid4())
    check("advisory lock no-ops on sqlite", True)
except AssertionError as e:
    print(f"     {e}")
    check("advisory lock no-ops on sqlite", False)

print("8) app_timezone never raises even with a bogus zone")
os.environ["APP_TIMEZONE"] = "Not/AZone"
check("bogus zone falls back without raising", cs.app_timezone() is not None)
os.environ["APP_TIMEZONE"] = tzname if tzname else "UTC"

print()
if failures:
    print(f"RESULT: {len(failures)} FAILED -> {failures}")
    sys.exit(1)
print("RESULT: ALL PASSED")
