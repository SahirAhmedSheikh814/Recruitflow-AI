"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { SlotPicker } from "@/components/dashboard/SlotPicker";
import { StatusBadge, ClassificationBadge } from "@/components/ui/StatusBadge";
import {
  ApiError,
  openProtectedResume,
  rejectBulk,
  resumeErrorMessage,
  sendInterviewInvitation,
  shortlistApplication,
  type PipelineRow,
} from "@/lib/api";

/**
 * Candidate detail panel with the recruiter's human-in-the-loop actions
 * (Module 7): shortlist, reject, and send an interview invitation. All actions
 * are server-authoritative; the board refreshes live via the events socket, so
 * we just fire the call and let the WebSocket push the new state back.
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
  if (!row) return null;

  const parsed = (row.candidate as unknown as { parsed_data?: Record<string, unknown> })?.parsed_data;

  async function run(action: string, fn: () => Promise<unknown>) {
    setBusy(action);
    setError(null);
    try {
      await fn();
      onAction?.();
      onClose();
    } catch (err) {
      // Surface the failure instead of swallowing it: on a failed interview
      // send the backend returns a 502 with a clear reason (e.g. the slot was
      // booked but the email could not be delivered). Keep the modal open so
      // the recruiter can read it and retry.
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  // Résumés are behind the backend's cookie-protected /files route, so fetch the
  // file through the authenticated API client and open the resulting blob rather
  // than navigating straight to the cross-origin backend URL (which sends no
  // auth cookie → 401). Unlike run(), this keeps the modal open on success.
  async function handleViewResume() {
    const url = row!.candidate?.resume_download_url;
    if (!url) return;
    setBusy("resume");
    setError(null);
    try {
      await openProtectedResume(url);
    } catch (err) {
      setError(resumeErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={row.candidate?.full_name ?? "Candidate"} wide>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={row.status} />
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

      {error && (
        <div className="mt-5 rounded-lg border border-rejected/30 bg-rejected/10 px-4 py-3 text-sm text-rejected">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {row.candidate?.resume_download_url && (
          <Button
            variant="secondary"
            className="h-10"
            loading={busy === "resume"}
            onClick={handleViewResume}
          >
            View résumé
          </Button>
        )}
        {!readOnly && (
          <>
            <Button
              variant="secondary"
              className="h-10"
              loading={busy === "shortlist"}
              onClick={() => run("shortlist", () => shortlistApplication(row.id))}
            >
              Shortlist
            </Button>
            <Button
              className="h-10"
              loading={busy === "interview"}
              onClick={() =>
                run("interview", () =>
                  sendInterviewInvitation(row.id, preferredSlot ?? undefined),
                )
              }
            >
              Send interview invite
            </Button>
            <Button
              variant="ghost"
              className="h-10 text-rejected hover:bg-rejected/10"
              loading={busy === "reject"}
              onClick={() => run("reject", () => rejectBulk([row.id]))}
            >
              Reject
            </Button>
          </>
        )}
      </div>

      {!readOnly && (
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
