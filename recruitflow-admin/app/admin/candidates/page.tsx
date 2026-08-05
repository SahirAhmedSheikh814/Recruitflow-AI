"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  getAllCandidates,
  updateCandidate,
  deleteCandidate,
  type CandidateRow,
} from "@/lib/api";

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  email: "Email",
  google_form: "Google Form",
  linkedin: "LinkedIn",
};

type Draft = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  current_location: string;
  linkedin_url: string;
  portfolio_url: string;
};

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CandidateRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getAllCandidates()
      .then(setCandidates)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = candidates.filter((c) => {
    if (!q) return true;
    const hay = `${c.full_name ?? ""} ${c.email ?? ""} ${c.current_location ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  function openEdit(c: CandidateRow) {
    setError(null);
    setDraft({
      id: c.id,
      full_name: c.full_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      current_location: c.current_location ?? "",
      linkedin_url: c.linkedin_url ?? "",
      portfolio_url: c.portfolio_url ?? "",
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await updateCandidate(draft.id, {
        full_name: draft.full_name,
        email: draft.email,
        phone: draft.phone || null,
        current_location: draft.current_location || null,
        linkedin_url: draft.linkedin_url || null,
        portfolio_url: draft.portfolio_url || null,
      });
      setDraft(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save candidate");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCandidate(pendingDelete.id);
      setPendingDelete(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete candidate");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-bold text-zinc-900">Candidates</h1>
          <p className="mt-1 text-sm text-zinc-500">Every candidate on record.</p>
        </div>
        <input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-10 w-64 rounded-lg border border-zinc-300 px-3 text-sm"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Résumé</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.current_location ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {SOURCE_LABEL[c.source_channel ?? ""] ?? c.source_channel ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.resume_download_url ? (
                      <a
                        href={c.resume_download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="h-9 px-3 text-sm"
                        onClick={() => openEdit(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9 px-3 text-sm text-rejected hover:bg-rejected/10"
                        onClick={() => {
                          setError(null);
                          setPendingDelete(c);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                    No candidates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit candidate */}
      <Modal open={!!draft} onClose={() => setDraft(null)} title="Edit candidate">
        {draft && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Full name</label>
              <input
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Email</label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Phone</label>
              <input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Location</label>
              <input
                value={draft.current_location}
                onChange={(e) => setDraft({ ...draft, current_location: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">LinkedIn URL</label>
              <input
                value={draft.linkedin_url}
                onChange={(e) => setDraft({ ...draft, linkedin_url: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Portfolio URL</label>
              <input
                value={draft.portfolio_url}
                onChange={(e) => setDraft({ ...draft, portfolio_url: e.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              />
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
      <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete candidate">
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Delete{" "}
              <span className="font-medium text-zinc-900">{pendingDelete.full_name ?? "this candidate"}</span>?
              This cannot be undone.
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
