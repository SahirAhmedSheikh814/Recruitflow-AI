import { Badge } from "@/components/ui/Badge";

/**
 * Canonical mapping of an application status to a themed badge, shared by every
 * dashboard so the pipeline reads consistently. Status badge colours follow the
 * brand system: green = shortlisted, red = rejected, amber = pending,
 * blue = interview.
 */
type Tone = "default" | "primary" | "shortlisted" | "rejected" | "pending" | "interview";

const STATUS_TONE: Record<string, Tone> = {
  received: "pending",
  parsed: "pending",
  scored: "pending",
  shortlisted: "shortlisted",
  rejected: "rejected",
  interview_scheduled: "interview",
  interview_completed: "interview",
  offer: "shortlisted",
  hired: "shortlisted",
};

const STATUS_LABEL: Record<string, string> = {
  received: "Received",
  parsed: "Parsed",
  scored: "Scored",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
  interview_scheduled: "Interview scheduled",
  interview_completed: "Interview completed",
  offer: "Offer",
  hired: "Hired",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "default"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

/** Badge for a score classification band. */
export function ClassificationBadge({ classification }: { classification: string | null }) {
  if (!classification) return <span className="text-zinc-400">—</span>;
  const tone: Tone = classification.startsWith("Highly")
    ? "shortlisted"
    : classification.startsWith("Recommended")
      ? "primary"
      : classification.startsWith("Consider")
        ? "pending"
        : "rejected";
  return <Badge tone={tone}>{classification}</Badge>;
}
