"use client";

import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Feature } from "@/types/feature";

/**
 * Detail card overlaid on the hovered panel (desktop) or permanently on every
 * panel (mobile). Sits on top of a photo, so it's intentionally theme-
 * independent: frosted-glass fill (white/10 + blur) with white text. Bold title
 * top-left, circular outline arrow-link button top-right, and the feature's full
 * bullet list with check-mark icons.
 */
const DetailCard = ({ feature }: { feature: Feature }) => {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-4 shadow-xl backdrop-blur-md transition-colors duration-300 lg:p-5 lg:hover:bg-primary">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-poppins text-base font-semibold leading-snug text-white lg:text-lg">
          {feature.title}
        </h3>
        {/* TODO: point at a dedicated feature-detail page once one exists. */}
        <Link
          href="#features"
          aria-label={`${feature.title} details`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/20"
        >
          <ArrowUpRight size={18} />
        </Link>
      </div>

      <ul className="mt-4 space-y-2">
        {feature.points.map((point, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-white/90">
            <Check size={16} className="mt-0.5 shrink-0 text-white" />
            <span className="leading-snug">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DetailCard;
