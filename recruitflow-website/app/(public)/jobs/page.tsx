import Link from "next/link";

import { getJobs } from "@/lib/jobs";
import { Badge } from "@/components/ui/Badge";

export const metadata = {
  title: "Open Roles · RecruitFlow AI",
};

// Always render per request so newly posted roles appear immediately.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="font-poppins text-3xl font-bold text-zinc-900">Open roles</h1>
      <p className="mt-2 text-zinc-500">
        {jobs.length > 0
          ? `${jobs.length} position${jobs.length === 1 ? "" : "s"} currently open`
          : "No open roles right now — check back soon."}
      </p>

      <div className="mt-10 flex flex-col gap-4">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="group rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-poppins text-lg font-semibold text-zinc-900 group-hover:text-primary">
                  {job.title}
                </h2>
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
        ))}
      </div>
    </div>
  );
}
