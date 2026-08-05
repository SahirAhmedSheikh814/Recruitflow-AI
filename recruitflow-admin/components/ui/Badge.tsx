import type { ReactNode } from "react";

type Tone = "default" | "primary" | "shortlisted" | "rejected" | "pending" | "interview";

const tones: Record<Tone, string> = {
  default: "bg-zinc-100 text-zinc-700",
  primary: "bg-primary/10 text-primary",
  shortlisted: "bg-shortlisted/10 text-shortlisted",
  rejected: "bg-rejected/10 text-rejected",
  pending: "bg-pending/10 text-pending",
  interview: "bg-interview/10 text-interview",
};

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
