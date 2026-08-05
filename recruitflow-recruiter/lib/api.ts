/**
 * Browser-side API client for the RecruitFlow backend.
 *
 * Auth uses httpOnly cookies set by the backend (access + refresh tokens), so
 * every request sends `credentials: "include"` and we never touch the token in
 * JS. On a 401 we transparently try the refresh endpoint once and replay the
 * original request, so a user with a valid refresh token never sees a blip
 * when their 15-minute access token expires.
 */

/**
 * Backend base URL.
 *
 * In the browser we call the SAME origin via the `/backend/*` rewrite (see
 * next.config.ts) so auth cookies are first-party to this Vercel domain and are
 * readable by proxy.ts. On the server we use the absolute backend URL, since a
 * relative path has no host server-side.
 */
const API_URL =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860"
    : "/backend";

/**
 * Which portal this frontend instance is. Each of the three dev servers sets
 * NEXT_PUBLIC_PORTAL (candidate | recruiter | admin) so the backend knows which
 * portal-scoped auth cookie to read — this is what keeps the three sessions
 * isolated. Undefined (the combined dev frontend) falls back to whichever single
 * cookie is present, preserving the original single-server behaviour.
 */
const PORTAL = process.env.NEXT_PUBLIC_PORTAL;

function portalHeaders(): Record<string, string> {
  return PORTAL ? { "X-Portal": PORTAL } : {};
}

/**
 * Cold-start–resilient fetch.
 *
 * The backend runs on Render's free tier, which spins the service down after
 * ~15 min of inactivity; the next request wakes it, taking ~40-60s. While it
 * boots, Render's router answers with 502/503/504 or refuses the connection
 * (native `fetch` rejects). Rather than surface those to the user as
 * "504 Gateway Timeout" / "Network Error", we wait and retry until the backend
 * responds. A `backend:waking` / `backend:awake` window event lets the UI show
 * a brief "waking up" notice (see components/ui/BackendWakeBanner).
 *
 * Only gateway statuses and network errors are retried — real application
 * responses (400, 401, 404, 409, …) pass straight through and are never retried.
 */
const WAKE_RETRY_STATUSES = new Set([502, 503, 504]);
const WAKE_MAX_RETRIES = 30; // ~30 × 3s ≈ 90s of patience — covers a 40-60s cold start
const WAKE_RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function emitWake(phase: "waking" | "awake") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(`backend:${phase}`));
  }
}

async function wakeFetch(input: string, init?: RequestInit): Promise<Response> {
  let announcedWaking = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(input, init);
      if (WAKE_RETRY_STATUSES.has(res.status) && attempt < WAKE_MAX_RETRIES) {
        if (!announcedWaking) {
          announcedWaking = true;
          emitWake("waking");
        }
        await sleep(WAKE_RETRY_DELAY_MS);
        continue;
      }
      if (announcedWaking) emitWake("awake");
      return res;
    } catch (err) {
      // Network-level failure: backend unreachable while it wakes. Keep waiting.
      if (attempt < WAKE_MAX_RETRIES) {
        if (!announcedWaking) {
          announcedWaking = true;
          emitWake("waking");
        }
        await sleep(WAKE_RETRY_DELAY_MS);
        continue;
      }
      if (announcedWaking) emitWake("awake");
      throw err;
    }
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export type Role = "admin" | "recruiter" | "candidate";

export interface CurrentUser {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  picture_url?: string;
  gender?: string;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data?.detail ?? data);
  } catch {
    return res.statusText || "Request failed";
  }
}

interface RequestOptions extends RequestInit {
  /** Internal flag: prevents infinite refresh loops. */
  _retried?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { _retried, headers, ...rest } = options;

  const res = await wakeFetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...portalHeaders(),
      ...headers,
    },
  });

  // Access token likely expired — try one silent refresh, then replay.
  if (res.status === 401 && !_retried && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await wakeFetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: portalHeaders(),
    });
    if (refreshed.ok) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  role: Role;
  full_name: string;
}

export function signup(email: string, password: string, full_name: string) {
  return apiFetch<AuthUser>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name }),
  });
}

export function login(email: string, password: string) {
  return apiFetch<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", { method: "POST" });
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/auth/me");
}

// ── Applications ───────────────────────────────────────────────────────────

export interface ApplicationSummary {
  id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  score: number | null;
  classification: string | null;
  score_explanation: string | null;
  created_at: string;
  updated_at: string;
  candidate?: Record<string, unknown>;
}

/**
 * Submit a job application with a resume file. Uses multipart/form-data — we
 * must NOT set Content-Type ourselves so the browser adds the correct
 * boundary. Works for both guests and logged-in candidates.
 */
export async function submitApplication(form: FormData): Promise<ApplicationSummary> {
  const res = await fetch(`${API_URL}/applications`, {
    method: "POST",
    credentials: "include",
    headers: portalHeaders(),
    body: form,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  return (await res.json()) as ApplicationSummary;
}

/** The logged-in candidate's own applications. */
export function getMyApplications() {
  return apiFetch<ApplicationSummary[]>("/applications/mine");
}

// ── ATS pipeline (recruiter / admin) ───────────────────────────────────────

export interface PipelineRow {
  id: string;
  status: string;
  score: number | null;
  classification: string | null;
  score_explanation: string | null;
  created_at: string;
  updated_at: string;
  candidate: {
    id: string | null;
    full_name: string | null;
    email: string | null;
    source_channel: string | null;
    resume_download_url: string | null;
  } | null;
  job: { id: string; title: string } | null;
}

export interface PipelineFilters {
  job_id?: string;
  status?: string;
  source_channel?: string;
  min_score?: number;
  max_score?: number;
}

export function getPipeline(filters: PipelineFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
  });
  const qs = params.toString();
  return apiFetch<PipelineRow[]>(`/ats/pipeline${qs ? `?${qs}` : ""}`);
}

/** Open a live WebSocket to the ATS event stream. Returns the socket. */
export function openPipelineSocket(): WebSocket {
  // WebSockets can't traverse the HTTP `/backend` rewrite, so connect straight
  // to the backend origin.
  const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7860";
  const base = origin.replace(/^http/, "ws");
  return new WebSocket(`${base}/ats/ws`);
}

// ── Human-in-the-loop actions (Module 7) ────────────────────────────────────

export function shortlistApplication(id: string) {
  return apiFetch<ApplicationSummary>(`/applications/${id}/shortlist`, { method: "POST" });
}

export function rejectBulk(application_ids: string[]) {
  return apiFetch<{ rejected: number }>("/applications/reject-bulk", {
    method: "POST",
    body: JSON.stringify({ application_ids }),
  });
}

export function sendInterviewInvitation(id: string, preferredStart?: string) {
  return apiFetch<{ status: string }>(`/applications/${id}/send-interview`, {
    method: "POST",
    body: JSON.stringify({ preferred_start: preferredStart ?? null }),
  });
}

export function getQualified(cutoff = 75, job_id?: string) {
  const params = new URLSearchParams({ cutoff: String(cutoff) });
  if (job_id) params.set("job_id", job_id);
  return apiFetch<ApplicationSummary[]>(`/applications/qualified/list?${params}`);
}

// ── Jobs (recruiter management) ─────────────────────────────────────────────

export interface JobRecord {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  required_skills: string[];
  status: "open" | "closed" | "draft";
  created_at: string;
  updated_at: string;
}

export interface JobInput {
  title: string;
  description: string;
  required_skills?: string[];
  status?: "open" | "closed" | "draft";
}

export function getMyJobs() {
  return apiFetch<JobRecord[]>("/jobs/mine/list");
}

export function createJob(body: JobInput) {
  return apiFetch<JobRecord>("/jobs", { method: "POST", body: JSON.stringify(body) });
}

export function updateJob(id: string, body: Partial<JobInput>) {
  return apiFetch<JobRecord>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function deleteJob(id: string) {
  return apiFetch<void>(`/jobs/${id}`, { method: "DELETE" });
}

// ── Recruiter profile / settings ────────────────────────────────────────────

export interface RecruiterProfile {
  id: string;
  company_name: string | null;
  working_hours_start: string;
  working_hours_end: string;
  google_calendar_connected: boolean;
}

export function getRecruiterProfile() {
  return apiFetch<RecruiterProfile>("/recruiter/profile");
}

export function updateRecruiterProfile(body: Partial<Omit<RecruiterProfile, "id" | "google_calendar_connected">>) {
  return apiFetch<RecruiterProfile>("/recruiter/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getCalendarConnectUrl() {
  return apiFetch<{ authorization_url: string }>("/interviews/calendar/connect");
}

// ── Interviews ──────────────────────────────────────────────────────────────

export interface InterviewRecord {
  id: string;
  application_id: string;
  google_event_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  cancellation_reason: string | null;
  last_candidate_reply: string | null;
  job_title?: string;
  candidate_name?: string;
  candidate_email?: string;
}

export function getInterviewByApplication(applicationId: string) {
  return apiFetch<InterviewRecord>(`/interviews/by-application/${applicationId}`);
}

/** All interviews across this recruiter's jobs (admins see all), with candidate details. */
export function getRecruiterInterviews() {
  return apiFetch<InterviewRecord[]>("/interviews/recruiter");
}

// ── Analytics (Module 14) ─────────────────────────────────────────────────

export interface AnalyticsSummary {
  total_applications: number;
  candidates_shortlisted: number;
  interview_pipeline: number;
  candidates_hired: number;
  recruitment_progress_pct: number;
  average_score: number | null;
  active_job_openings: number;
  time_to_hire_days: number | null;
  by_status: Record<string, number>;
}

export function getAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>("/analytics/summary");
}

export function getAdminAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>("/analytics/admin/summary");
}

// ── Admin (Module 13) ──────────────────────────────────────────────────────

export interface RecruiterRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export function getRecruiters() {
  return apiFetch<RecruiterRow[]>("/admin/recruiters");
}

export function createRecruiter(email: string, full_name: string, company_name?: string) {
  return apiFetch<{ id: string; email: string; full_name: string; temp_password: string }>(
    "/admin/recruiters",
    { method: "POST", body: JSON.stringify({ email, full_name, company_name }) },
  );
}

export function setRecruiterActive(id: string, is_active: boolean) {
  return apiFetch<{ id: string; is_active: boolean }>(`/admin/recruiters/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active }),
  });
}

export function getAllJobs() {
  return apiFetch<JobRecord[]>("/admin/jobs");
}

export interface CandidateRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  current_location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  source_channel: string | null;
  resume_download_url: string | null;
  parsed_data: Record<string, unknown> | null;
}

export function getAllCandidates() {
  return apiFetch<CandidateRow[]>("/admin/candidates");
}

export type CandidateInput = Partial<
  Pick<
    CandidateRow,
    "full_name" | "email" | "phone" | "current_location" | "linkedin_url" | "portfolio_url"
  >
>;

export function updateCandidate(id: string, body: CandidateInput) {
  return apiFetch<CandidateRow>(`/admin/candidates/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteCandidate(id: string) {
  return apiFetch<void>(`/admin/candidates/${id}`, { method: "DELETE" });
}

export interface AgentRunRow {
  id: string;
  agent_name: string;
  application_id: string | null;
  input_summary: string | null;
  output_summary: string | null;
  handed_off_to: string | null;
  status: string;
  created_at: string;
}

export function getAgentRuns(limit = 200) {
  return apiFetch<AgentRunRow[]>(`/admin/agent-runs?limit=${limit}`);
}
