"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  createJob,
  deleteJob,
  getMyJobs,
  updateJob,
  type JobRecord,
} from "@/lib/api";

type Draft = {
  id?: string;
  title: string;
  description: string;
  skills: string;
  status: "open" | "closed" | "draft";
};

const EMPTY: Draft = { title: "", description: "", skills: "", status: "draft" };

const STATUS_TONE = { open: "shortlisted", draft: "pending", closed: "rejected" } as const;

export default function RecruiterJobsPage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    getMyJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const body = {
      title: draft.title,
      description: draft.description,
      required_skills: draft.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      status: draft.status,
    };
    try {
      if (draft.id) await updateJob(draft.id, body);
      else await createJob(body);
      setDraft(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this job posting? This cannot be undone.")) return;
    await deleteJob(id);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-bold text-zinc-900">Jobs</h1>
          <p className="mt-1 text-sm text-zinc-500">Create and manage your job postings.</p>
        </div>
        <Button onClick={() => setDraft(EMPTY)}>New job</Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-400">
          No jobs yet. Create your first posting.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-poppins text-lg font-semibold text-zinc-900">{job.title}</h2>
                    <Badge tone={STATUS_TONE[job.status]}>{job.status}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{job.description}</p>
                  {job.required_skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.required_skills.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 px-3 text-sm"
                    onClick={() =>
                      setDraft({
                        id: job.id,
                        title: job.title,
                        description: job.description,
                        skills: job.required_skills.join(", "),
                        status: job.status,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 px-3 text-sm text-rejected hover:bg-rejected/10"
                    onClick={() => remove(job.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit job" : "New job"}
      >
        {draft && (
          <div className="flex flex-col gap-4">
            <label className="text-sm">
              <span className="text-zinc-600">Title</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={5}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Required skills (comma-separated)</span>
              <input
                value={draft.skills}
                onChange={(e) => setDraft({ ...draft, skills: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Status</span>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving} disabled={!draft.title.trim()}>
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
