"use client";

import { useEffect, useMemo, useState } from "react";

import { getRecruiterInterviews, ApiError, type InterviewRecord } from "@/lib/api";

/**
 * Recruiter Interviews — every scheduled/confirmed/completed interview across
 * the recruiter's jobs (admins see all), split into Upcoming and Past.
 */
export default function RecruiterInterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecruiterInterviews()
      .then(setInterviews)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load interviews."))
      .finally(() => setLoading(false));
  }, []);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const withTime = interviews.filter((iv) => iv.scheduled_start);
    return {
      upcoming: withTime
        .filter((iv) => new Date(iv.scheduled_start!).getTime() >= now && iv.status !== "completed")
        .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime()),
      past: withTime
        .filter((iv) => new Date(iv.scheduled_start!).getTime() < now || iv.status === "completed")
        .sort((a, b) => new Date(b.scheduled_start!).getTime() - new Date(a.scheduled_start!).getTime()),
    };
  }, [interviews]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="font-poppins text-xl font-bold text-zinc-900">Interviews</h2>
          <p className="mt-1 text-sm text-zinc-500">Manage and review scheduled interviews.</p>
        </div>
        {!loading && !error && interviews.length > 0 && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {upcoming.length} upcoming
          </span>
        )}
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
            Interviews you schedule from the pipeline will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {upcoming.length > 0 && (
            <Section title="Upcoming" rows={upcoming} />
          )}
          {past.length > 0 && <Section title="Past" rows={past} muted />}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  muted = false,
}: {
  title: string;
  rows: InterviewRecord[];
  muted?: boolean;
}) {
  return (
    <section>
      <h3 className="mb-3 font-poppins text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Candidate</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-zinc-100 ${muted ? "opacity-75" : ""}`}>
            {rows.map((iv) => (
              <tr key={iv.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{iv.candidate_name ?? "—"}</div>
                  {iv.candidate_email && (
                    <div className="text-xs text-zinc-400">{iv.candidate_email}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-700">{iv.job_title ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-700">
                  {iv.scheduled_start
                    ? new Date(iv.scheduled_start).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "TBD"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={iv.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}
