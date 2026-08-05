"use client";

import { useEffect, useState } from "react";

import { StatCard } from "@/components/ui/Card";
import { getAnalyticsSummary, getAdminAnalyticsSummary, type AnalyticsSummary } from "@/lib/api";

/**
 * KPI summary row (Module 14). Renders the seven headline recruitment metrics
 * as themed stat cards. `scope` picks the recruiter-scoped or global endpoint.
 */
export function AnalyticsCards({ scope }: { scope: "recruiter" | "admin" }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    const load = scope === "admin" ? getAdminAnalyticsSummary : getAnalyticsSummary;
    load().then(setData).catch(() => setData(null));
  }, [scope]);

  if (!data) {
    return <div className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white" />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Applications" value={data.total_applications} />
      <StatCard label="Shortlisted" value={data.candidates_shortlisted} />
      <StatCard label="In interview" value={data.interview_pipeline} />
      <StatCard label="Hired" value={data.candidates_hired} />
      <StatCard label="Avg. score" value={data.average_score ?? "—"} />
      <StatCard label="Active roles" value={data.active_job_openings} />
      <StatCard label="Progress" value={`${data.recruitment_progress_pct}%`} hint="resolved / total" />
      <StatCard
        label="Time to hire"
        value={data.time_to_hire_days !== null ? `${data.time_to_hire_days}d` : "—"}
      />
    </div>
  );
}
