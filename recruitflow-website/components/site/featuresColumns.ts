import { Feature } from "@/types/feature";
import featuresData from "./featuresData";

/**
 * 8 features → 5-column mapping (PRD §3/§5). Content is not defined here — each
 * panel points at a featuresData entry by id, so titles/points stay the single
 * source of truth. This file only decides which column each feature sits in and
 * which image overlays it.
 *
 * Structure (must stay exactly this shape):
 *   Column 1 — single, full height        → F1
 *   Column 2 — stacked pair (top/bottom)   → F2 / F3
 *   Column 3 — stacked pair (top/bottom)   → F4 / F5
 *   Column 4 — stacked pair (top/bottom)   → F6 / F7
 *   Column 5 — single, full height         → F8
 *   1 + 2 + 2 + 2 + 1 = 8 panels.
 *
 * Images are clean placeholders in `public/features/` — swapping in a real
 * image later is a one-line change per panel below.
 */

const byId = (id: number): Feature => {
  const feature = featuresData.find((f) => f.id === id);
  if (!feature) {
    throw new Error(`featuresColumns: no feature with id ${id} in featuresData`);
  }
  return feature;
};

const IMAGE_DIR = "/features";

export type FeaturePanel = {
  feature: Feature;
  image: string;
};

export type FeatureColumn = {
  /** 1-indexed column position, left to right */
  column: number;
  /** "single" = one full-height panel; "stacked" = top + bottom panels */
  kind: "single" | "stacked";
  panels: FeaturePanel[];
};

const featuresColumns: FeatureColumn[] = [
  {
    column: 1,
    kind: "single",
    panels: [{ feature: byId(1), image: `${IMAGE_DIR}/recruiter-dashboard.webp` }],
  },
  {
    column: 2,
    kind: "stacked",
    panels: [
      { feature: byId(2), image: `${IMAGE_DIR}/ai-resume-parsing.webp` },
      { feature: byId(3), image: `${IMAGE_DIR}/ai-job-matching.webp` },
    ],
  },
  {
    column: 3,
    kind: "stacked",
    panels: [
      { feature: byId(4), image: `${IMAGE_DIR}/human-review-pipeline.webp` },
      { feature: byId(5), image: `${IMAGE_DIR}/automated-scheduling-ats.webp` },
    ],
  },
  {
    column: 4,
    kind: "stacked",
    panels: [
      { feature: byId(6), image: `${IMAGE_DIR}/easy-profile-apply.webp` },
      { feature: byId(7), image: `${IMAGE_DIR}/multiple-recruiters-roles.webp` },
    ],
  },
  {
    column: 5,
    kind: "single",
    panels: [{ feature: byId(8), image: `${IMAGE_DIR}/realtime-status.webp` }],
  },
];

export default featuresColumns;
