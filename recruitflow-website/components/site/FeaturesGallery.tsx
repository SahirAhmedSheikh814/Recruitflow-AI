"use client";

import { useState } from "react";
import Image from "next/image";
import featuresColumns, { FeaturePanel } from "./featuresColumns";
import DetailCard from "./DetailCard";
import Reveal from "./Reveal";

/**
 * 5-column hover-expand accordion gallery (PRD §3).
 *
 * Desktop (lg+): CSS Grid, 5 column tracks + 2 row tracks. Columns 1 & 5 span
 * both rows (single panels); columns 2/3/4 hold a top + bottom panel. Hovering
 * any panel widens its whole column (grid-template-columns transition) while the
 * other 4 compress to strips; only the specifically hovered panel shows the
 * detail card.
 *
 * Mobile (< lg): grid dropped — 8 panels stacked full-width in order, each with
 * its detail card permanently visible over the image (no hover/tap), animating
 * in with an alternating left/right slide.
 */

// Sequential position of each panel in the flattened mobile stack, keyed by
// feature id. Drives the desktop stagger delay and the alternating mobile
// slide-in direction.
const mobileOrder: Record<number, number> = {};
featuresColumns
  .flatMap((col) => col.panels)
  .forEach((panel, i) => {
    mobileOrder[panel.feature.id] = i;
  });

const FeaturesGallery = () => {
  // Which column is currently expanded, and which panel within it is active.
  const [hovered, setHovered] = useState<{ column: number; panelId: number } | null>(
    null,
  );

  // Build the responsive grid-template-columns string: expanded column grows,
  // the other four compress to strips. All equal (1fr) when nothing is hovered.
  const templateColumns = featuresColumns
    .map((col) => (hovered && hovered.column === col.column ? "3.4fr" : "1fr"))
    .join(" ");

  return (
    <>
      {/* ── Desktop / laptop: interactive hover-expand grid ───────────────── */}
      <div
        className="hidden gap-4 transition-[grid-template-columns] duration-[400ms] ease-out lg:grid lg:h-[600px] xl:h-[680px] 2xl:h-[720px]"
        style={{
          gridTemplateColumns: templateColumns,
          gridTemplateRows: "1fr 1fr",
        }}
      >
        {featuresColumns.map((col) =>
          col.panels.map((panel, panelIndex) => {
            const isSingle = col.kind === "single";
            const isActive =
              hovered?.column === col.column && hovered?.panelId === panel.feature.id;

            return (
              <Reveal
                key={panel.feature.id}
                direction="up"
                amount={0.25}
                delay={mobileOrder[panel.feature.id] * 0.08}
                onMouseEnter={() =>
                  setHovered({ column: col.column, panelId: panel.feature.id })
                }
                onMouseLeave={() => setHovered(null)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl bg-black"
                style={{
                  gridColumn: col.column,
                  gridRow: isSingle ? "1 / span 2" : panelIndex === 0 ? 1 : 2,
                }}
              >
                {/* Full-bleed photo — eager-loaded so the gallery paints
                    immediately instead of lazy-popping as the user scrolls.
                    (Next 16 recommends loading="eager" over preload when many
                    images could each be the LCP element, as here.) */}
                <Image
                  src={panel.image}
                  alt={panel.feature.title}
                  fill
                  loading="eager"
                  sizes="(min-width: 1280px) 40vw, 30vw"
                  className="object-cover transition-transform duration-[400ms] ease-out group-hover:scale-105"
                />

                {/* Bottom legibility gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* Resting-state title label (bottom-left), fades out when this
                    panel shows its detail card */}
                <div
                  className={`absolute bottom-0 left-0 z-10 p-4 transition-opacity duration-300 ${
                    isActive ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <p className="font-poppins text-sm font-semibold leading-tight text-white drop-shadow-md lg:text-base">
                    {panel.feature.title}
                  </p>
                </div>

                {/* Detail card — only the specifically hovered panel */}
                <div
                  className={`absolute inset-x-0 bottom-0 z-20 p-4 transition-[opacity,transform] duration-300 ${
                    isActive
                      ? "translate-y-0 opacity-100"
                      : "pointer-events-none translate-y-4 opacity-0"
                  }`}
                >
                  <div className="max-w-[360px]">
                    <DetailCard feature={panel.feature} />
                  </div>
                </div>
              </Reveal>
            );
          }),
        )}
      </div>

      {/* ── Mobile / touch: stacked full-width panels, detail card always on ── */}
      <div className="flex flex-col gap-6 overflow-x-hidden lg:hidden">
        {featuresColumns.flatMap((col) =>
          col.panels.map((panel: FeaturePanel) => {
            // Alternate slide-in direction per card (even → left, odd → right).
            const dir = mobileOrder[panel.feature.id] % 2 === 0 ? "left" : "right";
            return (
              <Reveal
                key={panel.feature.id}
                direction={dir}
                amount={0.15}
                className="relative min-h-[560px] overflow-hidden rounded-2xl bg-black"
              >
                <Image
                  src={panel.image}
                  alt={panel.feature.title}
                  fill
                  loading="eager"
                  sizes="100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <DetailCard feature={panel.feature} />
                </div>
              </Reveal>
            );
          }),
        )}
      </div>
    </>
  );
};

export default FeaturesGallery;
