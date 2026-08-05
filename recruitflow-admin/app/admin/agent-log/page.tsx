"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { getAgentRuns, type AgentRunRow } from "@/lib/api";

/** Agent Activity Log (Module 13) — searchable timeline from `agent_runs`. */
export default function AdminAgentLogPage() {
  const [runs, setRuns] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    getAgentRuns()
      .then(setRuns)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      runs.filter((r) => {
        if (!q) return true;
        const hay = `${r.agent_name} ${r.input_summary ?? ""} ${r.output_summary ?? ""} ${r.handed_off_to ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      }),
    [runs, q],
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-poppins text-2xl font-bold text-zinc-900">Agent activity log</h1>
          <p className="mt-1 text-sm text-zinc-500">Every agent run, newest first.</p>
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
        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm"
            >
              <div className="w-40 shrink-0">
                <p className="font-medium text-zinc-900">{r.agent_name}</p>
                <p className="text-xs text-zinc-400">
                  {new Date(r.created_at).toLocaleString("en-AU")}
                </p>
              </div>
              <div className="flex-1">
                {r.input_summary && <p className="text-zinc-600">{r.input_summary}</p>}
                {r.output_summary && <p className="text-zinc-500">{r.output_summary}</p>}
                {r.handed_off_to && (
                  <p className="mt-1 text-xs text-zinc-400">→ handed off to {r.handed_off_to}</p>
                )}
              </div>
              <Badge tone={r.status === "success" ? "shortlisted" : "rejected"}>{r.status}</Badge>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-400">
              No agent runs yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
