"use client";

import { useState } from "react";

/**
 * User avatar with graceful fallbacks, in priority order:
 *   1. `src` (Google profile picture or an uploaded image) — shown if it loads
 *   2. a gender-based default silhouette (male / female) when `gender` is set
 *   3. the user's initial on a branded tint
 *
 * Sizing is driven by `size` (pixels); the component stays a perfect circle.
 */
export function Avatar({
  src,
  name,
  gender,
  size = 40,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  gender?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size };

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element — remote/dynamic avatar sources
      <img
        src={src}
        alt={name ?? "Profile picture"}
        style={dimension}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  const g = (gender ?? "").trim().toLowerCase();
  if (g === "male" || g === "female") {
    return (
      <span
        style={dimension}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
        aria-label={name ?? "Profile picture"}
      >
        <GenderSilhouette gender={g} size={size} />
      </span>
    );
  }

  return (
    <span
      style={dimension}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-poppins font-bold text-primary ${className}`}
      aria-label={name ?? "Profile picture"}
    >
      <span style={{ fontSize: size * 0.4 }}>{name?.[0]?.toUpperCase() ?? "U"}</span>
    </span>
  );
}

/** Flat, brand-tinted silhouette used when no photo is available. */
function GenderSilhouette({ gender, size }: { gender: "male" | "female"; size: number }) {
  const bg = gender === "female" ? "#FBE8F0" : "#E6ECFE";
  const fg = gender === "female" ? "#D6417F" : "#4A6CF7";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-hidden="true">
      <rect width="64" height="64" fill={bg} />
      {gender === "female" ? (
        <g fill={fg}>
          {/* head */}
          <circle cx="32" cy="24" r="11" />
          {/* shoulders */}
          <path d="M12 60c0-11 9-19 20-19s20 8 20 19z" />
          {/* hair accents framing the face */}
          <path d="M18 24c0-8 6-15 14-15s14 7 14 15c-3-6-8-8-14-8s-11 2-14 8z" opacity="0.55" />
        </g>
      ) : (
        <g fill={fg}>
          {/* head */}
          <circle cx="32" cy="23" r="11" />
          {/* shoulders */}
          <path d="M13 60c0-11 8-18 19-18s19 7 19 18z" />
        </g>
      )}
    </svg>
  );
}
