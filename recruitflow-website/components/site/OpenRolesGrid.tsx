"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Job } from "@/lib/jobs";

// Component-scoped entrance keyframes (Tailwind v4 doesn't ship these by default).
// Mirrors the fade-in-up language already used in HomeHero.
const gridCss = `
@keyframes open-roles-fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.open-role-card {
  opacity: 0;
}
.open-role-card.is-visible {
  animation: open-roles-fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .open-role-card,
  .open-role-card.is-visible {
    opacity: 1;
    animation: none;
  }
}
`;

export function OpenRolesGrid({ jobs }: { jobs: Job[] }) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      // Show immediately, no scroll-in animation.
      setVisible(true);
      return;
    }

    const node = gridRef.current;
    if (!node) return;

    // Fire the staggered entrance once, the first time the grid scrolls into view.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{gridCss}</style>

      <div
        ref={gridRef}
        className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8"
      >
        {jobs.map((job, index) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className={`open-role-card group rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl ${
              visible ? "is-visible" : ""
            }`}
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <h3 className="font-poppins text-lg font-semibold text-zinc-900 group-hover:text-primary">
              {job.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500">
              {job.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {job.required_skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
