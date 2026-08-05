"use client";

import { useEffect, useMemo, useState } from "react";

import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards";
import { CandidateDetailModal } from "@/components/dashboard/CandidateDetailModal";
import { PipelineKanban } from "@/components/dashboard/PipelineKanban";
import { PipelineTable } from "@/components/dashboard/PipelineTable";
import { Button } from "@/components/ui/Button";
import { useLivePipeline } from "@/lib/useLivePipeline";
import { rejectBulk, getQualified, type PipelineRow, type ApplicationSummary } from "@/lib/api";

const STATUSES = [
  "received",
  "parsed",
  "scored",
  "shortlisted",
  "rejected",
  "interview_scheduled",
  "interview_completed",
  "offer",
  "hired",
];

export default function RecruiterPipelinePage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [minScore, setMinScore] = useState("");
  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      min_score: minScore ? Number(minScore) : undefined,
    }),
    [statusFilter, minScore],
  );

  const { rows, loading, error, refetch } = useLivePipeline(filters);
  const [selectedRow, setSelectedRow] = useState<PipelineRow | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState(false);
  const [view, setView] = useState<"table" | "board">("table");
  const [qualified, setQualified] = useState<ApplicationSummary[]>([]);

  useEffect(() => {
    getQualified().then(setQualified).catch(() => setQualified([]));
  }, []);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkReject() {
    if (checked.size === 0) return;
    if (!confirm(`Reject ${checked.size} candidate(s)? They will be emailed a rejection.`)) return;
    setRejecting(true);
    try {
      await rejectBulk([...checked]);
      setChecked(new Set());
      refetch();
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <AnalyticsCards scope="recruiter" />

      {/* Recruitment Pipeline card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-poppins text-lg font-semibold text-zinc-900">Recruitment Pipeline</h2>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Min score"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="h-9 w-24 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
            />
            <div className="flex rounded-lg border border-zinc-300 bg-white p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setView("table")}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  view === "table" ? "bg-primary text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  view === "board" ? "bg-primary text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Board
              </button>
            </div>
            {checked.size > 0 && (
              <Button
                variant="ghost"
                className="h-9 px-3 text-sm text-rejected hover:bg-rejected/10"
                loading={rejecting}
                onClick={handleBulkReject}
              >
                Reject {checked.size}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-400">Loading pipeline…</div>
        ) : error ? (
          <div className="rounded-lg border border-rejected/30 bg-rejected/5 px-4 py-3 text-sm text-rejected">
            {error}
          </div>
        ) : view === "board" ? (
          <PipelineKanban rows={rows} onSelect={setSelectedRow} />
        ) : (
          <PipelineTable
            rows={rows}
            onSelect={setSelectedRow}
            selectable
            selected={checked}
            onToggle={toggle}
          />
        )}
      </div>

      {/* Two-column: Recent Sourcing Matches + Tasks for Today */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-poppins text-lg font-semibold text-zinc-900">Recent Sourcing Matches</h3>
            <button className="text-xs font-medium text-primary hover:underline">View all</button>
          </div>
          {qualified.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">No shortlisted candidates yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {qualified.slice(0, 5).map((app) => {
                const name = (app.candidate?.full_name as string | undefined) ?? "Candidate";
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-medium text-primary">
                      {name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-zinc-900">{name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {app.classification ?? "Shortlisted"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {app.score ?? "—"}/100
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 font-poppins text-lg font-semibold text-zinc-900">Tasks for Today</h3>
          <p className="py-8 text-center text-sm text-zinc-400">
            Task tracking will be available soon.
          </p>
        </div>
      </div>

      <CandidateDetailModal
        row={selectedRow}
        open={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
        onAction={refetch}
      />
    </div>
  );
}
