"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { HeroBackground } from "./HeroBackground";

const BADGE_TEXT = "Staffing and Recruitment Solutions";
const TYPE_SPEED_MS = 55;
const LOOP_PAUSE_MS = 3000; // hold the full text for 3s before retyping

// Entrance timing (ms). Heading starts as the typewriter is finishing, for a smooth overlap;
// subheading and buttons follow in a staggered fade-in-up.
const HEADING_DELAY = 1500;
const SUBHEADING_DELAY = 1700;
const BUTTONS_DELAY = 1900;

// Component-scoped entrance keyframes (Tailwind v4 doesn't ship these by default).
const heroCss = `
@keyframes hero-fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.hero-enter {
  animation: hero-fade-in-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .hero-enter { animation: none; }
}
`;

export function HomeHero() {
  const [typed, setTyped] = useState("");
  const [paused, setPaused] = useState(false); // true during the 3s hold — cursor blinks then
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      // No typewriter/loop — show the full text immediately, no cursor.
      setReducedMotion(true);
      setTyped(BADGE_TEXT);
      return;
    }

    setReducedMotion(false);

    // Looping typewriter: type out -> hold 3s -> clear -> type again, forever.
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (i <= BADGE_TEXT.length) {
        setTyped(BADGE_TEXT.slice(0, i));
        setPaused(false);
        i += 1;
        timer = setTimeout(tick, TYPE_SPEED_MS);
      } else {
        // Full text shown — hold, then restart from empty.
        setPaused(true);
        timer = setTimeout(() => {
          i = 0;
          tick();
        }, LOOP_PAUSE_MS);
      }
    };
    tick();

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{heroCss}</style>

      {/* The section is pulled up behind the sticky floating header (home page only) so the
          artwork runs edge-to-edge from the very top of the page — no white band behind the
          header. Header flow height ≈ 92px (mobile) / 120px (lg); content padding compensates. */}
      <section className="relative -mt-[92px] overflow-hidden lg:-mt-[120px]">
        {/* Animated brand background — full-bleed, behind content. Blue orbs, orbiting
            rings, floating shapes and a dot grid concentrated on the right where the
            hero copy leaves open space; the left stays clean white for text legibility. */}
        <HeroBackground />

        <div className="pl-6 pr-6 pb-24 pt-[calc(92px+4rem)] text-left sm:pl-10 sm:pr-8 sm:pb-28 lg:pl-16 lg:pr-12 lg:pb-36 lg:pt-[calc(120px+6rem)]">
          {/* Badge — looping typewriter. The full string is rendered invisibly underneath to
              reserve final width and prevent layout shift as characters appear. */}
          <div className="hero-enter" style={{ animationDelay: "0ms" }}>
            <span
              aria-label={BADGE_TEXT}
              className="relative inline-flex items-center rounded-full border border-primary/20 bg-primary/15 px-5 py-2 font-poppins text-sm font-semibold tracking-wide text-primary shadow-sm sm:text-base lg:text-lg"
            >
              <span aria-hidden="true" className="invisible whitespace-pre">
                {BADGE_TEXT}
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-5 flex items-center whitespace-pre"
              >
                {typed}
                {!reducedMotion && (
                  <span
                    className={`ml-0.5 inline-block h-[1.1em] w-0.5 bg-primary ${
                      paused ? "animate-pulse" : ""
                    }`}
                  />
                )}
              </span>
            </span>
          </div>

          <h1
            className="hero-enter mt-6 font-poppins text-5xl font-bold leading-[1.15] tracking-tight text-zinc-900 sm:text-6xl lg:text-8xl xl:text-8xl"
            style={{
              animationDelay: `${HEADING_DELAY}ms`,
              textShadow:
                "0 0 18px rgba(255,255,255,0.92), 0 1px 3px rgba(255,255,255,0.92)",
            }}
          >
            Find your next role, screened{" "}
            <span className="text-primary">intelligently.</span>
          </h1>

          <p
            className="hero-enter mt-6 text-lg text-zinc-600 sm:text-xl lg:text-2xl"
            style={{
              animationDelay: `${SUBHEADING_DELAY}ms`,
              textShadow: "0 0 14px rgba(255,255,255,0.9)",
            }}
          >
            We use AI-powered screening to match great people with great teams
            faster, fairer, and with real feedback at every step.
          </p>

          <div
            className="hero-enter mt-10 flex flex-wrap justify-start gap-4"
            style={{ animationDelay: `${BUTTONS_DELAY}ms` }}
          >
            <Link
              href="/jobs"
              className="inline-flex h-14 items-center rounded-lg bg-primary px-8 font-poppins text-base font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg lg:h-16 lg:px-10 lg:text-lg"
            >
              Browse open roles
            </Link>
            <Link
              href="/about"
              className="inline-flex h-14 items-center rounded-lg border border-zinc-300 bg-white px-8 font-poppins text-base font-medium text-zinc-900 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-lg lg:h-16 lg:px-10 lg:text-lg"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
