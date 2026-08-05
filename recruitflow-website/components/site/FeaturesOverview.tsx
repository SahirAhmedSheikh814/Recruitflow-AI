"use client";

import {
  LayoutDashboard,
  ScanText,
  Target,
  ListChecks,
  CalendarCheck,
  UserCircle,
  Briefcase,
  Bell,
  type LucideIcon,
} from "lucide-react";
import Reveal from "./Reveal";

/**
 * "Overview of Features" grid (Features PRD §4/§6.3).
 *
 * A flat, static card grid — deliberately NOT the home page's hover-expand
 * FeaturesGallery. Plain white cards (icon badge + title + one-sentence copy),
 * all content always visible, extended to fit all 8 RecruitFlow AI features.
 * Icons reuse the same icon language as featuresData.ts to stay consistent.
 */

interface OverviewCard {
  icon: LucideIcon;
  title: string;
  description: string;
}

const CARDS: OverviewCard[] = [
  {
    icon: LayoutDashboard,
    title: "Recruiter Dashboard",
    description:
      "Manage every job posting, applicant, and hiring update from one unified dashboard built for recruiters.",
  },
  {
    icon: ScanText,
    title: "AI Resume Parsing (LLM-Powered)",
    description:
      "Every resume is automatically parsed into structured candidate data — no manual entry required.",
  },
  {
    icon: Target,
    title: "AI Job Matching & Candidate Scoring",
    description:
      "Candidates are automatically matched and scored against each job description, surfacing the best fits first.",
  },
  {
    icon: ListChecks,
    title: "Human Review & Hiring Pipeline",
    description:
      "Recruiters stay in control, reviewing AI-scored candidates and moving them through a clear hiring pipeline.",
  },
  {
    icon: CalendarCheck,
    title: "Automated Scheduling & ATS Sync",
    description:
      "Interviews get booked and ATS records get updated automatically the moment a decision is made.",
  },
  {
    icon: UserCircle,
    title: "Easy Profile & One-Click Apply",
    description:
      "Candidates build a profile once and apply to any open role in just a click.",
  },
  {
    icon: Briefcase,
    title: "Access to Multiple Recruiters & Roles",
    description:
      "Browse and apply to roles from many different recruiters, all in one place.",
  },
  {
    icon: Bell,
    title: "Real-Time Status & Fastest Response",
    description:
      "Candidates always know exactly where they stand, with real-time updates and fast recruiter responses.",
  },
];

export function FeaturesOverview() {
  return (
    <section className="relative bg-white px-6 py-20 sm:px-8 lg:px-12 lg:py-28">
      {/* Faint blue-white wash for gentle separation from the hero above */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#f5f7ff] to-transparent"
      />

      <div className="relative mx-auto max-w-[88rem]">
        <Reveal direction="up">
          <h2 className="text-center font-poppins text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
            Overview of <span className="text-primary">Features</span>
          </h2>
        </Reveal>
        <Reveal direction="up" delay={0.12}>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base leading-relaxed text-zinc-500 lg:text-lg">
            A closer look at everything RecruitFlow AI gives recruiters and
            candidates, in one platform.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal
                key={card.title}
                direction="up"
                amount={0.15}
                delay={(i % 4) * 0.08}
                className="group h-full rounded-2xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg lg:p-7"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-poppins text-lg font-semibold leading-snug text-zinc-900">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {card.description}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
