"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getMyApplications, ApiError, type ApplicationSummary } from "@/lib/api";
import type { Job } from "@/lib/jobs";
import { Badge } from "@/components/ui/Badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

/** Fetch open roles directly from the public jobs endpoint (no auth needed). */
async function fetchOpenJobs(): Promise<Job[]> {
  const res = await fetch(`${API_URL}/jobs`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, "Failed to load roles.");
  return (await res.json()) as Job[];
}

export default function PortalJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchOpenJobs(), getMyApplications()])
      .then(([openJobs, apps]: [Job[], ApplicationSummary[]]) => {
        setJobs(openJobs);
        setAppliedJobIds(new Set(apps.map((a) => a.job_id)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load roles."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div>
        <h1 className="font-poppins text-2xl font-bold text-zinc-900">
          Browse <span className="text-primary">Roles</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {jobs.length > 0
            ? `${jobs.length} position${jobs.length === 1 ? "" : "s"} currently open`
            : "Explore every role that's currently open."}
        </p>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="py-16 text-center text-zinc-400">Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-rejected/30 bg-rejected/5 px-4 py-3 text-sm text-rejected">
            {error}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
            <p className="text-zinc-500">No open roles right now — check back soon.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map((job) => {
              const applied = appliedJobIds.has(job.id);
              return (
                <Link
                  key={job.id}
                  href={`/portal/jobs/${job.id}`}
                  className="group rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-poppins text-lg font-semibold text-zinc-900 group-hover:text-primary">
                          {job.title}
                        </h2>
                        {applied ? <Badge tone="shortlisted">Applied</Badge> : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{job.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {job.required_skills.slice(0, 5).map((skill) => (
                          <Badge key={skill}>{skill}</Badge>
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      View →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
