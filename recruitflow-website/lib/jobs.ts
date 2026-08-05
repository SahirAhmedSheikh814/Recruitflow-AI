/**
 * Server-safe job fetching for the public career site.
 *
 * These run in Server Components and hit the backend directly. `fetch` is
 * uncached by default in Next.js 16, so job data is always fresh. Failures
 * (e.g. backend down during a build) degrade gracefully to empty/null instead
 * of throwing, so a static build never breaks on an unreachable API.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";

export interface Job {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  required_skills: string[];
  status: "open" | "closed" | "draft";
  created_at: string;
  updated_at: string;
}

export async function getJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${API_URL}/jobs`, { cache: "no-store" });
    if (!res.ok) return [];
    return (await res.json()) as Job[];
  } catch {
    return [];
  }
}

export async function getJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(`${API_URL}/jobs/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Job;
  } catch {
    return null;
  }
}
