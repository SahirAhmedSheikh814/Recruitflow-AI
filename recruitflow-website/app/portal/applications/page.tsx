"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getMyApplications, ApiError, type ApplicationSummary } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE: Record<string, "default" | "primary" | "shortlisted" | "rejected" | "pending" | "interview"> = {
  received: "pending",
  parsed: "pending",
  scored: "pending",
  shortlisted: "shortlisted",
  rejected: "rejected",
  interview_scheduled: "interview",
  interview_completed: "interview",
  offer: "shortlisted",
  hired: "shortlisted",
};

const STATUS_LABEL: Record<string, string> = {
  received: "Received",
  parsed: "Under review",
  scored: "Under review",
  shortlisted: "Shortlisted",
  rejected: "Not progressing",
  interview_scheduled: "Interview scheduled",
  interview_completed: "Interview completed",
  offer: "Offer extended",
  hired: "Hired",
};

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyApplications()
      .then(setApps)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applications."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-poppins text-xl font-bold text-zinc-900">My Applications</h2>
        <p className="mt-1 text-sm text-zinc-500">Track the status of every role you&apos;ve applied for.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400">Loading…</div>
      ) : error ? (
        <div className="rounded-lg border border-rejected/30 bg-rejected/5 px-4 py-3 text-sm text-rejected">
          {error}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-zinc-500">You haven&apos;t applied for any roles yet.</p>
          <Link
            href="/portal/jobs"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium font-poppins text-white hover:bg-primary/90"
          >
            Browse open roles
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {apps.map((app) => (
            <div key={app.id} className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-zinc-400">
                    Applied {new Date(app.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <h3 className="mt-1 font-poppins font-semibold text-zinc-900">
                    {app.job?.title ?? "Application"}
                  </h3>
                </div>
                <Badge tone={STATUS_TONE[app.status] ?? "default"}>
                  {STATUS_LABEL[app.status] ?? app.status}
                </Badge>
              </div>
              {app.score !== null && (
                <div className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  <span className="font-medium">AI Score: {app.score}/100</span>
                  {app.classification && (
                    <span className="ml-2 text-zinc-400">· {app.classification}</span>
                  )}
                  {app.score_explanation && (
                    <p className="mt-1 text-zinc-500">{app.score_explanation}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
