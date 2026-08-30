/**
 * Browser-side API client for Riva, the candidate assistant.
 *
 * Thin wrapper over the shared `apiFetch` (cookie auth, cold-start retries, the
 * `/backend` rewrite) — same transport as the rest of the app. Riva's routes are
 * candidate-only on the backend; nothing here can reach recruiter/admin data.
 *
 * The submission itself is NOT done here: when a turn returns a `submission`
 * object, the widget hands it to the existing `submitApplication(FormData)` in
 * lib/api.ts (the same call the web apply form uses), attaching the résumé File
 * the browser is already holding.
 */
import { apiFetch } from "@/lib/api";

export type RivaRole = "user" | "assistant";

export interface RivaMessage {
  id: string;
  role: RivaRole;
  content: string;
  created_at: string;
}

/** Fields the backend hands back when a draft is ready for POST /applications. */
export interface RivaSubmission {
  job_id: string;
  full_name: string;
  email: string;
  job_title?: string | null;
}

export interface RivaConversation {
  conversation_id: string;
  messages: RivaMessage[];
}

export interface RivaMessageResponse {
  user_message: RivaMessage;
  assistant_message: RivaMessage;
  /** Present only when Riva marked the draft ready this turn. */
  submission?: RivaSubmission;
}

export function getRivaConversation() {
  return apiFetch<RivaConversation>("/riva/conversation");
}

export function sendRivaMessage(content: string, resumeFilename?: string) {
  return apiFetch<RivaMessageResponse>("/riva/messages", {
    method: "POST",
    body: JSON.stringify({ content, resume_filename: resumeFilename ?? null }),
  });
}

export function reportRivaOutcome(params: {
  success: boolean;
  application_id?: string;
  error?: string;
}) {
  return apiFetch<{ assistant_message: RivaMessage }>("/riva/outcome", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function clearRivaConversation() {
  return apiFetch<void>("/riva/conversation", { method: "DELETE" });
}
