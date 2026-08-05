"use client";

import { useEffect, useState } from "react";

import { getMyInterviews, ApiError, type InterviewRecord } from "@/lib/api";

/**
 * Candidate Interviews — every scheduled/confirmed/completed interview for the
 * signed-in candidate, newest first, split into Upcoming and Past.
 */
export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyInterviews()
      .then(setInterviews)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load interviews."))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const withTime = interviews.filter((iv) => iv.scheduled_start);
  const upcoming = withTime
    .filter((iv) => new Date(iv.scheduled_start!).getTime() >= now && iv.status !== "completed")
    .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());
  const past = withTime
    .filter((iv) => new Date(iv.scheduled_start!).getTime() < now || iv.status === "completed")
    .sort((a, b) => new Date(b.scheduled_start!).getTime() - new Date(a.scheduled_start!).getTime());

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-poppins text-xl font-bold text-zinc-900">Interviews</h2>
        <p className="mt-1 text-sm text-zinc-500">Your scheduled and completed interviews.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400">Loading…</div>
      ) : error ? (
        <div className="rounded-lg border border-rejected/30 bg-rejected/5 px-4 py-3 text-sm text-rejected">
          {error}
        </div>
      ) : interviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-zinc-500">No interviews scheduled yet.</p>
          <p className="mt-2 text-xs text-zinc-400">
            When recruiters schedule interviews, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {upcoming.length > 0 && (
            <section>
              <h3 className="mb-3 font-poppins text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Upcoming
              </h3>
              <ul className="flex flex-col gap-3">
                {upcoming.map((iv) => (
                  <InterviewRow key={iv.id} iv={iv} />
                ))}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h3 className="mb-3 font-poppins text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Past
              </h3>
              <ul className="flex flex-col gap-3">
                {past.map((iv) => (
                  <InterviewRow key={iv.id} iv={iv} muted />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewRow({ iv, muted = false }: { iv: InterviewRecord; muted?: boolean }) {
  const start = iv.scheduled_start ? new Date(iv.scheduled_start) : null;
  const end = iv.scheduled_end ? new Date(iv.scheduled_end) : null;
  return (
    <li
      className={`flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 ${
        muted ? "opacity-75" : ""
      }`}
    >
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-interview/10 text-interview">
        {start ? (
          <>
            <span className="text-[10px] font-semibold uppercase leading-none">
              {start.toLocaleDateString(undefined, { month: "short" })}
            </span>
            <span className="text-lg font-bold leading-tight">{start.getDate()}</span>
          </>
        ) : (
          <span className="text-xs">TBD</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">{iv.job_title ?? "Interview"}</p>
        <p className="text-sm text-zinc-500">
          {start
            ? start.toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Time to be confirmed"}
          {start && end
            ? ` – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
            : ""}
        </p>
        {iv.cancellation_reason && (
          <p className="mt-1 text-xs text-rejected">{iv.cancellation_reason}</p>
        )}
      </div>
      <StatusPill status={iv.status} />
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    proposed: { label: "Proposed", cls: "bg-pending/10 text-pending" },
    confirmed: { label: "Confirmed", cls: "bg-shortlisted/10 text-shortlisted" },
    rescheduled: { label: "Rescheduled", cls: "bg-interview/10 text-interview" },
    completed: { label: "Completed", cls: "bg-zinc-100 text-zinc-500" },
    cancelled: { label: "Cancelled", cls: "bg-rejected/10 text-rejected" },
  };
  const m = map[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-500" };
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}
