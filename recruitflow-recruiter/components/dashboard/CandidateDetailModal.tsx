"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SlotPicker } from "@/components/dashboard/SlotPicker";
import { StatusBadge, ClassificationBadge } from "@/components/ui/StatusBadge";
import {
  ApiError,
  rejectBulk,
  sendInterviewInvitation,
  shortlistApplication,
  type PipelineRow,
} from "@/lib/api";

// The candidate action funnel advances in one direction: a candidate is first
// shortlisted, then sent an interview invitation. Buttons are shown per stage so
// the recruiter always sees exactly the next valid action.
const PRE_SHORTLIST = ["received", "parsed", "scored"];
const INTERVIEW_SENT = ["interview_scheduled", "interview_completed", "offer", "hired"];

/**
 * Candidate detail panel with the recruiter's human-in-the-loop actions
 * (Module 7): shortlist, reject, and send an interview invitation. Actions are
 * server-authoritative; on success we advance a local view of the status so the
 * button set updates immediately (Shortlist → Send interview invite → sent),
 * while the board still refreshes live via the events socket.
 */
export function CandidateDetailModal({
  row,
  open,
  onClose,
  onAction,
  readOnly = false,
}: {
  row: PipelineRow | null;
  open: boolean;
  onClose: () => void;
  onAction?: () => void;
  readOnly?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [preferredSlot, setPreferredSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Local, optimistic view of the status so the button set updates the instant an
  // action succeeds. Reset whenever a different candidate is opened.
  const [localStatus, setLocalStatus] = useState<string>(row?.status ?? "");

  useEffect(() => {
    setLocalStatus(row?.status ?? "");
    setError(null);
    setSuccess(null);
    setPreferredSlot(null);
  }, [row?.id]);

  if (!row) return null;

  const parsed = (row.candidate as unknown as { parsed_data?: Record<string, unknown> })?.parsed_data;
  const candidateName = row.candidate?.full_name ?? "This candidate";
  const jobTitle = row.job?.title ?? "this role";

  const showShortlist = PRE_SHORTLIST.includes(localStatus);
  const showSendInterview = localStatus === "shortlisted";
  const interviewSent = INTERVIEW_SENT.includes(localStatus);
  // Reject stays available at every stage until the candidate is hired.
  const canReject = localStatus !== "rejected" && localStatus !== "hired";

  async function handleShortlist() {
    setBusy("shortlist");
    setError(null);
    setSuccess(null);
    try {
      await shortlistApplication(row!.id);
      setLocalStatus("shortlisted");
      setSuccess(`${candidateName} is shortlisted for the ${jobTitle} role.`);
      onAction?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSendInterview() {
    setBusy("interview");
    setError(null);
    setSuccess(null);
    try {
      await sendInterviewInvitation(row!.id, preferredSlot ?? undefined);
      setLocalStatus("interview_scheduled");
      setSuccess(`Interview invitation email sent to ${candidateName} for the ${jobTitle} role.`);
      onAction?.();
    } catch (err) {
      // A 409 here means the chosen slot is unavailable (conflict or outside
      // working hours) — the backend returns the specific reason. Keep the modal
      // open with the shortlisted stage intact so the recruiter can pick again.
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    setError(null);
    setSuccess(null);
    try {
      await rejectBulk([row!.id]);
      onAction?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={row.candidate?.full_name ?? "Candidate"} wide>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={localStatus || row.status} />
        <ClassificationBadge classification={row.classification} />
        {row.score !== null && (
          <span className="text-sm font-medium text-zinc-700">Score: {row.score}/100</span>
        )}
        {row.job && <span className="text-sm text-zinc-400">· {row.job.title}</span>}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Email" value={row.candidate?.email} />
        <Field label="Source" value={row.candidate?.source_channel} />
      </dl>

      {row.score_explanation && (
        <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <p className="font-medium text-zinc-700">Why this score</p>
          <p className="mt-1">{row.score_explanation}</p>
        </div>
      )}

      {parsed && (
        <details className="mt-4 rounded-lg border border-zinc-200 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-700">Parsed resume data</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-zinc-500">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </details>
      )}

      {success && (
        <div className="mt-5 rounded-lg border border-shortlisted/30 bg-shortlisted/10 px-4 py-3 text-sm text-shortlisted">
          {success}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg border border-rejected/30 bg-rejected/10 px-4 py-3 text-sm text-rejected">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {row.candidate?.resume_download_url && (
          <a
            href={row.candidate.resume_download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            View résumé
          </a>
        )}
        {!readOnly && (
          <>
            {showShortlist && (
              <Button
                variant="secondary"
                className="h-10"
                loading={busy === "shortlist"}
                onClick={handleShortlist}
              >
                Shortlist
              </Button>
            )}
            {showSendInterview && (
              <Button className="h-10" loading={busy === "interview"} onClick={handleSendInterview}>
                Send interview invite
              </Button>
            )}
            {interviewSent && (
              <Button className="h-10" disabled>
                Interview Invitation Sent
              </Button>
            )}
            {canReject && (
              <Button
                variant="ghost"
                className="h-10 text-rejected hover:bg-rejected/10"
                loading={busy === "reject"}
                onClick={handleReject}
              >
                Reject
              </Button>
            )}
          </>
        )}
      </div>

      {!readOnly && showSendInterview && (
        <div className="mt-4">
          <SlotPicker value={preferredSlot} onChange={setPreferredSlot} />
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-zinc-800">{value || "—"}</dd>
    </div>
  );
}
