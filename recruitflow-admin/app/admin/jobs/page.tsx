"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAllJobs, updateJob, deleteJob, type JobRecord } from "@/lib/api";

const STATUS_TONE = { open: "shortlisted", draft: "pending", closed: "rejected" } as const;

type Draft = {
  id: string;
  title: string;
  description: string;
  skills: string;
  status: "open" | "closed" | "draft";
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<JobRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getAllJobs()
      .then(setJobs)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openEdit(j: JobRecord) {
    setError(null);
    setDraft({
      id: j.id,
      title: j.title,
      description: j.description,
      skills: j.required_skills.join(", "),
      status: j.status,
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await updateJob(draft.id, {
        title: draft.title,
        description: draft.description,
        required_skills: draft.skills.split(",").map((s) => s.trim()).filter(Boolean),
        status: draft.status,
      });
      setDraft(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save job");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteJob(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete job");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="font-poppins text-2xl font-bold text-zinc-900">All jobs</h1>
      <p className="mt-1 text-sm text-zinc-500">Every posting across all recruiters.</p>

      {loading ? (
        <div className="py-16 text-center text-zinc-400">Loading…</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Skills</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{j.title}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {j.required_skills.slice(0, 4).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[j.status]}>{j.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(j.created_at).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="h-9 px-3 text-sm"
                        onClick={() => openEdit(j)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3 text-sm text-rejected hover:bg-rejected/10"
                        onClick={() => {
                          setError(null);
                          setPendingDelete(j);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                    No jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit job */}
      <Modal open={!!draft} onClose={() => setDraft(null)} title="Edit job">
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Title</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Required skills <span className="text-zinc-400">(comma-separated)</span>
              </label>
              <input
                value={draft.skills}
                onChange={(e) => setDraft({ ...draft, skills: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Status</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {error && <p className="text-sm text-rejected">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete job">
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Delete <span className="font-medium text-zinc-900">{pendingDelete.title}</span>? This
              cannot be undone.
            </p>
            {error && <p className="text-sm text-rejected">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                className="bg-rejected hover:bg-rejected/90"
                onClick={confirmDelete}
                loading={deleting}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
