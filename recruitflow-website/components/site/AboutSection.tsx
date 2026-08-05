"use client";

import Image from "next/image";
import Reveal from "./Reveal";
import { TopGlow } from "./TopGlow";
import type { AboutSectionData } from "./aboutData";

/**
 * About Us section template (PRD §3/§4) — the reference layout rebuilt in
 * RecruitFlow AI's light/premium theme. Structure, top to bottom:
 *
 *   background (white + subtle blue tint + dot grid)
 *   ├─ left column:  heading → tagline → body paragraph(s)
 *   └─ right column: framed placeholder photo + designed decorative shapes
 *   stats row (3 blocks, evenly spaced, divided)
 *
 * Everything fades/slides up on scroll with a slight stagger, reusing the
 * shared <Reveal> wrapper (which already respects prefers-reduced-motion).
 */

/** Designed decorative illustrations layered around the image (not placeholders). */
function Decor({ variant }: { variant: 1 | 2 | 3 }) {
  const common = "pointer-events-none absolute";
  if (variant === 1) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* glowing orb behind the frame */}
        <div className={`${common} -bottom-8 -left-8 h-52 w-52 rounded-full bg-primary/20 blur-3xl`} />
        {/* large soft ring, top-right, partially clipped */}
        <div className={`${common} -right-10 -top-10 h-52 w-52 rounded-full border border-primary/20`} />
        {/* dashed ring, bottom-right */}
        <div className={`${common} -bottom-6 right-8 h-28 w-28 rounded-full border border-dashed border-primary/30`} />
        {/* small filled accent dots */}
        <div className={`${common} left-4 -top-3 h-3 w-3 rounded-full bg-primary`} />
        <div className={`${common} -left-4 top-1/2 h-2.5 w-2.5 rounded-full bg-primary/60`} />
        <div className={`${common} right-2 top-6 h-2 w-2 rounded-full bg-primary/50`} />
      </div>
    );
  }
  if (variant === 2) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className={`${common} -bottom-8 -right-8 h-52 w-52 rounded-full bg-primary/15 blur-3xl`} />
        {/* two overlapping rings, top-left */}
        <div className={`${common} -left-10 -top-10 h-44 w-44 rounded-full border border-primary/20`} />
        <div className={`${common} -left-2 -top-2 h-24 w-24 rounded-full border border-primary/25`} />
        {/* rotated square, top-right */}
        <div className={`${common} -right-5 top-6 h-10 w-10 rotate-12 rounded-md bg-primary/15`} />
        {/* small dot cluster, bottom-left */}
        <div className={`${common} bottom-4 -left-4 grid grid-cols-3 gap-1.5`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/30" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className={`${common} -top-8 -right-8 h-52 w-52 rounded-full bg-primary/15 blur-3xl`} />
      {/* large arc/ring, top-right */}
      <div className={`${common} -right-12 -top-12 h-56 w-56 rounded-full border border-primary/20`} />
      {/* diamond, top-left */}
      <div className={`${common} -left-4 top-8 h-8 w-8 rotate-45 rounded-sm bg-primary/20`} />
      {/* dashed ring, bottom-left */}
      <div className={`${common} -bottom-6 left-6 h-24 w-24 rounded-full border border-dashed border-primary/30`} />
      {/* accent dots */}
      <div className={`${common} right-6 bottom-2 h-3 w-3 rounded-full bg-primary`} />
      <div className={`${common} left-1/3 -bottom-3 h-2 w-2 rounded-full bg-primary/50`} />
    </div>
  );
}

export function AboutSection({
  data,
  showTopGlow = false,
}: {
  data: AboutSectionData;
  showTopGlow?: boolean;
}) {
  const { heading, tagline, blocks, stats, image, imageAlt, decor, tint } = data;

  return (
    <section
      className={`relative overflow-hidden py-20 lg:py-28 ${tint ? "bg-[#f7f9ff]" : "bg-white"}`}
    >
      {/* Soft primary light shining down from the top (first section only) */}
      {showTopGlow && <TopGlow />}

      {/* Premium background texture: soft corner gradient + faint dot grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 85% 15%, rgba(74,108,247,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(74,108,247,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 xl:max-w-[1440px]">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text column */}
          <div>
            <Reveal direction="up">
              <h2 className="font-poppins text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
                {heading}
              </h2>
            </Reveal>

            <Reveal direction="up" delay={0.12}>
              <p className="mt-4 font-poppins text-lg font-semibold text-primary lg:text-xl">
                {tagline}
              </p>
            </Reveal>

            <Reveal direction="up" delay={0.24}>
              <div className="mt-6 space-y-5">
                {blocks.map((block, i) => (
                  <div
                    key={i}
                    className={block.label ? "border-l-2 border-primary/60 pl-4" : ""}
                  >
                    {block.label && (
                      <h3 className="font-poppins text-base font-semibold text-zinc-900">
                        {block.label}
                      </h3>
                    )}
                    <p
                      className={`text-base leading-relaxed text-zinc-500 lg:text-lg ${
                        block.label ? "mt-1" : ""
                      }`}
                    >
                      {block.body}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right — framed photo + decorative illustrations */}
          <Reveal direction="up" delay={0.36}>
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <Decor variant={decor} />
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 shadow-xl">
                <Image
                  src={image}
                  alt={imageAlt}
                  width={800}
                  height={600}
                  loading="eager"
                  sizes="(min-width: 1024px) 45vw, 90vw"
                  className="h-auto w-full object-cover"
                />
              </div>
            </div>
          </Reveal>
        </div>

        {/* Stats row */}
        <Reveal direction="up" delay={0.48}>
          <div className="mt-16 grid grid-cols-1 gap-8 rounded-2xl border border-zinc-200/70 bg-white/70 p-8 backdrop-blur-sm sm:grid-cols-3 sm:divide-x sm:divide-zinc-200 lg:mt-20">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center sm:px-4">
                <div className="font-poppins text-4xl font-bold text-primary lg:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm text-zinc-500 lg:text-base">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
