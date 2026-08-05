import Link from "next/link";
import { notFound } from "next/navigation";

import { getJob } from "@/lib/jobs";
import { ApplyForm } from "@/components/site/ApplyForm";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job || job.status !== "open") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href={`/jobs/${job.id}`} className="text-sm text-zinc-500 hover:text-primary">
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
