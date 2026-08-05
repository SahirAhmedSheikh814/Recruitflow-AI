"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { AnalyticsCards } from "@/components/dashboard/AnalyticsCards";
import { CandidateDetailModal } from "@/components/dashboard/CandidateDetailModal";
import { PipelineKanban } from "@/components/dashboard/PipelineKanban";
import { PipelineTable } from "@/components/dashboard/PipelineTable";
import { useLivePipeline } from "@/lib/useLivePipeline";
import { getAllCandidates, getAllJobs, type PipelineRow, type CandidateRow, type JobRecord } from "@/lib/api";

export default function AdminPipelinePage() {
  const { rows, loading, error, refetch } = useLivePipeline();
  const [selectedRow, setSelectedRow] = useState<PipelineRow | null>(null);
  const [view, setView] = useState<"table" | "board">("table");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);

  useEffect(() => {
    Promise.all([getAllCandidates(), getAllJobs()])
      .then(([c, j]) => {
        setCandidates(c);
        setJobs(j);
      })
      .catch(() => {});
  }, []);

  // Candidate sources aggregation (real data)
  const sourceCounts = candidates.reduce((acc, c) => {
    const src = c.source_channel || "unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ["#4A6CF7", "#16A34A", "#F59E0B", "#EF4444", "#8B5CF6"];

  // Application trends placeholder (no time-series endpoint)
  const trendData = [
    { month: "Jan", applications: 45 },
    { month: "Feb", applications: 52 },
    { month: "Mar", applications: 61 },
    { month: "Apr", applications: 70 },
    { month: "May", applications: 58 },
    { month: "Jun", applications: 75 },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <AnalyticsCards scope="admin" />

      {/* Two-column: Application Trends + Candidate Sources */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 font-poppins text-lg font-semibold text-zinc-900">Application Trends over Time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
              <Tooltip />
              <Line type="monotone" dataKey="applications" stroke="#4A6CF7" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="mb-4 font-poppins text-lg font-semibold text-zinc-900">Candidate Sources</h3>
          {sourceData.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-sm text-zinc-400">
              No candidates yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry) => entry.name}
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Global Pipeline card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-poppins text-lg font-semibold text-zinc-900">Global Pipeline</h2>
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
          <PipelineTable rows={rows} onSelect={setSelectedRow} />
        )}
      </div>

      {/* Latest Job Postings */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-poppins text-lg font-semibold text-zinc-900">Latest Job Postings</h3>
          <button className="text-xs font-medium text-primary hover:underline">View all</button>
        </div>
        {jobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">No jobs posted yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50"
              >
                <div>
                  <p className="font-medium text-zinc-900">{job.title}</p>
                  <p className="text-xs text-zinc-500">
                    {job.status === "open" ? "Open" : job.status === "closed" ? "Closed" : "Draft"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  job.status === "open"
                    ? "bg-shortlisted/10 text-shortlisted"
                    : job.status === "closed"
                    ? "bg-zinc-100 text-zinc-600"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        )}
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
