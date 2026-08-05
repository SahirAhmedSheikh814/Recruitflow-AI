"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Job } from "@/lib/jobs";
import { ApplyForm } from "@/components/site/ApplyForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

async function fetchJob(id: string): Promise<Job | null> {
  const res = await fetch(`${API_URL}/jobs/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as Job;
}

export default function PortalApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJob(id)
      .then((j) => {
        if (!j || j.status !== "open") {
          notFound();
        }
        setJob(j);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !job) {
    return <div className="py-16 text-center text-zinc-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/portal/jobs/${job.id}`} className="text-sm text-zinc-500 hover:text-primary">
        ← Back to role
      </Link>

      <h1 className="mt-6 font-poppins text-3xl font-bold text-zinc-900">Apply</h1>
      <p className="mt-2 text-zinc-500">
        You&apos;re applying for <span className="font-medium text-zinc-700">{job.title}</span>.
      </p>

      <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <ApplyForm jobId={job.id} jobTitle={job.title} />
      </div>
    </div>
  );
}
