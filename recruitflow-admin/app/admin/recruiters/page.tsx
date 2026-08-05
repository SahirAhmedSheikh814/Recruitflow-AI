"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  createRecruiter,
  getRecruiters,
  setRecruiterActive,
  type RecruiterRow,
} from "@/lib/api";

export default function AdminRecruitersPage() {
  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; temp_password: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function load() {
    getRecruiters()
      .then(setRecruiters)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit() {
    setCreating(true);
    setErr(null);
    try {
      const res = await createRecruiter(email, fullName, company || undefined);
      setCreated({ email: res.email, temp_password: res.temp_password });
      setEmail("");
      setFullName("");
      setCompany("");
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create recruiter.");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(r: RecruiterRow) {
    await setRecruiterActive(r.id, !r.is_active);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-bold text-zinc-900">Recruiters</h1>
          <p className="mt-1 text-sm text-zinc-500">Create recruiter accounts and manage access.</p>
        </div>
        <Button
          onClick={() => {
            setCreated(null);
            setShowCreate(true);
          }}
        >
          Add recruiter
        </Button>
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
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recruiters.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{r.full_name}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={r.is_active ? "shortlisted" : "rejected"}>
                      {r.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle(r)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {r.is_active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add recruiter">
        {created ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600">
              Recruiter created. Share these one-time credentials securely — the password is shown only now.
            </p>
            <div className="rounded-lg bg-zinc-50 p-4 text-sm">
              <p>
                <span className="text-zinc-400">Email:</span>{" "}
                <span className="font-medium">{created.email}</span>
              </p>
              <p className="mt-1">
                <span className="text-zinc-400">Temp password:</span>{" "}
                <code className="font-mono font-medium">{created.temp_password}</code>
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowCreate(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="text-sm">
              <span className="text-zinc-600">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Company (optional)</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
              />
            </label>
            {err && <p className="text-sm text-rejected">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={submit} loading={creating} disabled={!email.trim() || !fullName.trim()}>
                Create
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
