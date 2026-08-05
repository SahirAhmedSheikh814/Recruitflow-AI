"use client";

import Link from "next/link";
import {
  motion,
  useReducedMotion,
  type Variants,
  type Transition,
} from "framer-motion";
import {
  ArrowUpRight,
  Search,
  Calendar,
  MessageSquare,
  Users,
  Star,
} from "lucide-react";

import { TopGlow } from "./TopGlow";

/**
 * Features page hero (Features PRD §3/§5/§6.1/§6.2).
 *
 * Re-themed to match the home hero: a clean white canvas with only a very light
 * hint of brand-blue (faint corner wash + barely-there dot grid). Text is black
 * (zinc-900) with the accent word and CTA in the brand primary, so everything
 * reads crisply against white — same colour language as HomeHero.
 *   left  → heading (accent word) + paragraph + primary pill CTA
 *   right → a layered set of real white UI-style cards (decorative placeholders)
 *
 * The section is pulled up behind the sticky white pill header via the negative
 * top margin so the header floats over it. The text layout is intentionally its
 * own (centred column, not pushed hard-left like the home hero). All entrance
 * motion respects prefers-reduced-motion.
 */

// Header height (incl. its own top padding): 92px mobile, 120px desktop — matches
// SiteHeader (h-[76px]+pt-4 / lg:h-24+lg:pt-6) so the blue block sits behind it.
const stagger = 0.14;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const cardIn: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export function FeaturesHero() {
  const reduce = useReducedMotion();

  // With reduced motion we skip transforms entirely (elements show in place).
  const t = (delay: number): Transition =>
    reduce
      ? { duration: 0 }
      : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] };

  return (
    <section className="relative -mt-[92px] overflow-hidden bg-white lg:-mt-[120px]">
      {/* Very light hint of brand-blue on an otherwise clean white canvas — a faint
          corner wash, a couple of soft blue glows and a barely-there dot grid. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-[#eef1fe]" />
        <TopGlow />
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-primary/[0.06] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(74,108,247,0.07) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-[88rem] grid-cols-1 items-center gap-14 px-6 pb-20 pt-[calc(92px+3.5rem)] sm:px-8 lg:grid-cols-2 lg:gap-10 lg:px-12 lg:pb-28 lg:pt-[calc(120px+5rem)]">
        {/* ── Left: heading + paragraph + CTA ─────────────────────────────── */}
        <div className="max-w-xl text-left">
          <motion.h1
            initial={reduce ? false : "hidden"}
            animate="visible"
            variants={fadeUp}
            transition={t(0)}
            className="font-poppins text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl"
          >
            Explore Everything RecruitFlow AI Has to{" "}
            <span className="text-primary">Offer</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : "hidden"}
            animate="visible"
            variants={fadeUp}
            transition={t(stagger)}
            className="mt-6 text-base leading-relaxed text-zinc-600 sm:text-lg"
          >
            From AI-powered resume screening to one-click applications,
            RecruitFlow AI brings recruiters and candidates together on a single,
            intelligent hiring platform.
          </motion.p>

          <motion.div
            initial={reduce ? false : "hidden"}
            animate="visible"
            variants={fadeUp}
            transition={t(stagger * 2)}
            className="mt-9"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-3 rounded-full bg-primary py-2 pl-7 pr-2 font-poppins text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105"
            >
              Sign Up Free
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </Link>
          </motion.div>
        </div>

        {/* ── Right: layered illustration mockup (real cards) ─────────────── */}
        <HeroMockup reduce={!!reduce} cardIn={cardIn} t={t} />
      </div>
    </section>
  );
}

/** Decorative overlapping card composition — placeholder content only (§6.2). */
function HeroMockup({
  reduce,
  cardIn,
  t,
}: {
  reduce: boolean;
  cardIn: Variants;
  t: (delay: number) => Transition;
}) {
  const bars = [45, 70, 55, 85, 65];
  const chips = [
    { Icon: Search, label: "Search" },
    { Icon: Calendar, label: "Schedule" },
    { Icon: MessageSquare, label: "Messages" },
    { Icon: Users, label: "Candidates" },
    { Icon: Star, label: "Shortlist" },
  ];

  const card = (delay: number, className: string, children: React.ReactNode) => (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="visible"
      variants={cardIn}
      transition={t(delay)}
      className={className}
    >
      {children}
    </motion.div>
  );

  // On the new white canvas the cards need a hairline ring + soft shadow to read.
  const cardBase =
    "rounded-2xl bg-white ring-1 ring-zinc-200/80 shadow-[0_10px_40px_rgba(74,108,247,0.10)]";

  return (
    <div className="relative mx-auto h-[460px] w-full max-w-[520px] sm:h-[500px] lg:mx-0">
      {/* Profile card — top-left */}
      {card(
        0.2,
        `absolute left-0 top-2 z-20 w-64 p-4 ${cardBase}`,
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#3B5BF6] font-poppins text-sm font-semibold text-white">
              JL
            </div>
            <div>
              <p className="font-poppins text-sm font-semibold text-zinc-900">
                Jordan Lee
              </p>
              <p className="text-xs text-zinc-500">Frontend Developer</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["React", "TypeScript", "Node"].map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        </>,
      )}

      {/* Stats card — top-right, overlapping */}
      {card(
        0.32,
        `absolute right-0 top-0 z-10 w-56 p-4 ${cardBase}`,
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500">Match Score</p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              Strong
            </span>
          </div>
          <p className="mt-1 font-poppins text-2xl font-bold text-zinc-900">92%</p>
          <div className="mt-3 flex h-16 items-end gap-1.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-primary/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </>,
      )}

      {/* Stage tracker card — center-bottom, widest */}
      {card(
        0.44,
        `absolute bottom-20 left-4 z-30 w-[310px] p-5 ${cardBase}`,
        <>
          <div className="flex items-center justify-between">
            <p className="font-poppins text-sm font-semibold text-zinc-900">
              Application Progress
            </p>
            <span className="text-[11px] font-medium text-primary">2 / 3</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              Applied
            </span>
            <span className="text-zinc-300">→</span>
            <span className="rounded-full bg-primary px-3 py-1 text-white shadow-sm">
              Shortlisted
            </span>
            <span className="text-zinc-300">→</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-400">
              Interview
            </span>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-2/3 rounded-full bg-primary" />
          </div>
        </>,
      )}

      {/* Tool/activity icon chip row — bottom */}
      {card(
        0.56,
        `absolute bottom-0 right-2 z-20 flex items-center gap-2 px-3 py-2 ${cardBase} rounded-full`,
        <>
          {chips.map(({ Icon, label }) => (
            <span
              key={label}
              aria-label={label}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Icon className="h-4 w-4" />
            </span>
          ))}
        </>,
      )}
    </div>
  );
}
