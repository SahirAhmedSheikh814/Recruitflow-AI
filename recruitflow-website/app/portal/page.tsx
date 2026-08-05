"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getCurrentUser, getMyApplications, getMyInterviews, type CurrentUser, type ApplicationSummary, type InterviewRecord } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Candidate Dashboard — PRD Section 5.1.
 * Profile card + completion bar (placeholder %), application-status rings (real counts),
 * upcoming interviews (placeholder), activity feed (placeholder), suggested jobs (real open jobs).
 */
export default function CandidateDashboardPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [apps, setApps] = useState<ApplicationSummary[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCurrentUser(), getMyApplications(), getMyInterviews().catch(() => [])])
      .then(([u, a, iv]) => {
        setUser(u);
        setApps(a);
        setInterviews(iv);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-16 text-center text-zinc-400">Loading…</div>;
  }

  // Application status counts — real data derived from getMyApplications()
  const applied = apps.filter((a) =>
    ["received", "parsed", "scored"].includes(a.status)
  ).length;
  const interviewing = apps.filter((a) =>
    ["shortlisted", "interview_scheduled", "interview_completed"].includes(a.status)
  ).length;
  const offers = apps.filter((a) => ["offer", "hired"].includes(a.status)).length;

  // Upcoming interviews — real data; future-dated, soonest first
  const now = Date.now();
  const upcoming = interviews
    .filter((iv) => iv.scheduled_start && new Date(iv.scheduled_start).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());

  // Profile completion — placeholder (no such metric exists yet)
  const completionPct = 65;

  return (
    <div className="flex flex-col gap-6">
      {/* Profile summary card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <Avatar
            src={user?.picture_url}
            name={user?.full_name}
            gender={user?.gender}
            size={64}
            className="ring-2 ring-primary/10"
          />
          <div className="flex-1">
            <h2 className="font-poppins text-xl font-bold text-zinc-900">{user?.full_name ?? "User"}</h2>
            <p className="text-sm text-zinc-500">{user?.email}</p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Profile completion</span>
                <span className="font-medium text-zinc-700">{completionPct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Application Status rings + Upcoming Interviews */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="font-poppins text-lg font-semibold text-zinc-900">Application Status</h3>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <RingCard label="Applied" value={applied} color="#4A6CF7" />
            <RingCard label="Interviewing" value={interviewing} color="#6B7280" />
            <RingCard label="Offers" value={offers} color="#16A34A" />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-poppins text-lg font-semibold text-zinc-900">Upcoming Interviews</h3>
            {upcoming.length > 0 && (
              <Link href="/portal/interviews" className="text-xs font-medium text-primary hover:underline">
                View All
              </Link>
            )}
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-6 text-center text-sm text-zinc-400">
              No interviews scheduled yet.
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {upcoming.slice(0, 3).map((iv) => (
                <li
                  key={iv.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-interview/10 text-interview">
                    <InterviewCalendarBadge iso={iv.scheduled_start!} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {iv.job_title ?? "Interview"}
                    </p>
                    <p className="text-xs text-zinc-500">{formatInterviewTime(iv.scheduled_start!)}</p>
                  </div>
                  <StatusPill status={iv.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Two-column: My Activity + Suggested Jobs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-poppins text-lg font-semibold text-zinc-900">My Activity</h3>
            <Link href="/portal/applications" className="text-xs font-medium text-primary hover:underline">
              View All
            </Link>
          </div>
          <div className="mt-6 text-center text-sm text-zinc-400">
            Your application activity will appear here.
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-2">
            <h3 className="font-poppins text-lg font-semibold text-zinc-900">Suggested Jobs</h3>
            <p className="text-xs text-zinc-400">Based on your profile</p>
          </div>
          <div className="mt-4">
            <Link
              href="/portal/jobs"
              className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 text-sm hover:bg-zinc-50"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900">Browse all open roles</p>
                <p className="text-xs text-zinc-500">Find your next opportunity</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RingCard({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / 10, 1); // cap ring at 10 for visual consistency
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-poppins text-2xl font-bold text-zinc-900">
          {value}
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-600">{label}</p>
    </div>
  );
}

/** Small calendar-tile badge showing the day number + short month. */
function InterviewCalendarBadge({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <>
      <span className="text-[9px] font-semibold uppercase leading-none">
        {d.toLocaleDateString(undefined, { month: "short" })}
      </span>
      <span className="text-sm font-bold leading-tight">{d.getDate()}</span>
    </>
  );
}

function formatInterviewTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    proposed: { label: "Proposed", cls: "bg-pending/10 text-pending" },
    confirmed: { label: "Confirmed", cls: "bg-shortlisted/10 text-shortlisted" },
    rescheduled: { label: "Rescheduled", cls: "bg-interview/10 text-interview" },
    completed: { label: "Completed", cls: "bg-zinc-100 text-zinc-500" },
  };
  const m = map[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-500" };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}
