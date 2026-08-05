"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getMyApplications, ApiError, type ApplicationSummary } from "@/lib/api";
import type { Job } from "@/lib/jobs";
import { Badge } from "@/components/ui/Badge";

// Client component → call the same-origin proxy (see next.config.ts rewrites).
const API_URL = "/backend";

async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`${API_URL}/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as Job;
}

export default function PortalJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [job, setJob] = useState<Job | null>(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.all([fetchJob(id), getMyApplications()])
      .then(([j, apps]: [Job | null, ApplicationSummary[]]) => {
        if (!j || j.status !== "open") {
          setMissing(true);
          return;
        }
        setJob(j);
        setApplied(apps.some((a) => a.job_id === id));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (missing) {
    notFound();
  }

  if (loading || !job) {
    return (
      <div className="py-16 text-center text-zinc-400">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/portal/jobs" className="text-sm text-zinc-500 hover:text-primary">
        ← Back to all roles
      </Link>

      <div className="mt-6">
        <Badge tone="primary">Open</Badge>
        <h1 className="mt-3 font-poppins text-3xl font-bold text-zinc-900">{job.title}</h1>
      </div>

      {job.required_skills.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Required skills
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {job.required_skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          About the role
        </h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-700">
          {job.description}
        </p>
      </div>

      <div className="mt-10 flex gap-4 border-t border-zinc-200 pt-8">
        {applied ? (
          <span className="inline-flex h-12 items-center rounded-lg bg-shortlisted/10 px-6 text-sm font-medium font-poppins text-shortlisted">
            Applied
          </span>
        ) : (
          <Link
            href={`/portal/jobs/${job.id}/apply`}
            className="inline-flex h-12 items-center rounded-lg bg-primary px-6 text-sm font-medium font-poppins text-white transition-colors hover:bg-primary/90"
          >
            Apply for this role
          </Link>
        )}
      </div>
    </div>
  );
}
