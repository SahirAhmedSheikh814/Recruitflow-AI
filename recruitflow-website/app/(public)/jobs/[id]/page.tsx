import Link from "next/link";
import { notFound } from "next/navigation";

import { getJob } from "@/lib/jobs";
import { Badge } from "@/components/ui/Badge";

export default async function JobDetailPage({
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
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/jobs" className="text-sm text-zinc-500 hover:text-primary">
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
        <Link
          href={`/jobs/${job.id}/apply`}
          className="inline-flex h-12 items-center rounded-lg bg-primary px-6 text-sm font-medium font-poppins text-white transition-colors hover:bg-primary/90"
        >
          Apply for this role
        </Link>
      </div>
    </div>
  );
}
