"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PipelineRow } from "@/lib/api";

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  email: "Email",
  google_form: "Google Form",
  linkedin: "LinkedIn",
};

/** Live pipeline table shared by the recruiter and admin boards. */
export function PipelineTable({
  rows,
  onSelect,
  selectable = false,
  selected = new Set<string>(),
  onToggle,
}: {
  rows: PipelineRow[];
  onSelect: (row: PipelineRow) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-400">
        No applications yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {selectable && <th className="w-10 px-4 py-3" />}
            <th className="px-4 py-3 font-medium">Candidate</th>
            <th className="px-4 py-3 font-medium">Job</th>
            <th className="px-4 py-3 font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer hover:bg-zinc-50"
              onClick={() => onSelect(row)}
            >
              {selectable && (
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => onToggle?.(row.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/40"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900">{row.candidate?.full_name ?? "—"}</p>
                <p className="text-xs text-zinc-400">{row.candidate?.email}</p>
              </td>
              <td className="px-4 py-3 text-zinc-600">{row.job?.title ?? "—"}</td>
              <td className="px-4 py-3">
                {row.score !== null ? (
                  <span className="font-medium text-zinc-900">{row.score}</span>
                ) : (
                  <span className="text-zinc-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {SOURCE_LABEL[row.candidate?.source_channel ?? ""] ?? row.candidate?.source_channel ?? "—"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
