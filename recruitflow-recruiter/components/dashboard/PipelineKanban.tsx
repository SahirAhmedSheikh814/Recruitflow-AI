"use client";

import type { PipelineRow } from "@/lib/api";

/**
 * Kanban view of the ATS pipeline (Module 12). Renders the same `rows` the
 * PipelineTable consumes — just grouped into stage columns — so search/filter
 * and live WebSocket updates keep working unchanged. Cards are clickable and
 * open the shared candidate detail modal via `onSelect`.
 */

const STAGES: { key: string; label: string; accent: string }[] = [
  { key: "received", label: "Received", accent: "bg-amber-400" },
  { key: "parsed", label: "Parsed", accent: "bg-amber-400" },
  { key: "scored", label: "Scored", accent: "bg-amber-400" },
  { key: "shortlisted", label: "Shortlisted", accent: "bg-green-500" },
  { key: "rejected", label: "Rejected", accent: "bg-rejected" },
  { key: "interview_scheduled", label: "Interview scheduled", accent: "bg-primary" },
  { key: "interview_completed", label: "Interview completed", accent: "bg-primary" },
  { key: "offer", label: "Offer", accent: "bg-green-500" },
  { key: "hired", label: "Hired", accent: "bg-green-500" },
];

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  email: "Email",
  google_form: "Google Form",
  linkedin: "LinkedIn",
};

export function PipelineKanban({
  rows,
  onSelect,
}: {
  rows: PipelineRow[];
  onSelect: (row: PipelineRow) => void;
}) {
  const grouped = new Map<string, PipelineRow[]>();
  for (const stage of STAGES) grouped.set(stage.key, []);
  for (const row of rows) {
    if (!grouped.has(row.status)) grouped.set(row.status, []);
    grouped.get(row.status)!.push(row);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const cards = grouped.get(stage.key) ?? [];
        return (
          <div key={stage.key} className="flex w-72 shrink-0 flex-col">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${stage.accent}`} />
              <h3 className="font-poppins text-sm font-semibold text-zinc-700">{stage.label}</h3>
              <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                {cards.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2">
              {cards.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-zinc-300">Empty</div>
              ) : (
                cards.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onSelect(row)}
                    className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <p className="truncate font-medium text-zinc-900">
                      {row.candidate?.full_name ?? "—"}
                    </p>
                    <p className="truncate text-xs text-zinc-400">{row.job?.title ?? "—"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">
                        {SOURCE_LABEL[row.candidate?.source_channel ?? ""] ??
                          row.candidate?.source_channel ??
                          "—"}
                      </span>
                      {row.score !== null ? (
                        <span className="font-semibold text-zinc-900">{row.score}</span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
