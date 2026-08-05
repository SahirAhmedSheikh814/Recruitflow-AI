/**
 * TopGlow — a subtle soft blue light shining down from the very top of the page.
 *
 * A single decorative, non-interactive overlay: a wide primary-tinted radial
 * bloom centred at the top edge, fading out quickly downward so it reads as a
 * gentle wash of light rather than a solid band. Uses the brand primary at very
 * low opacity so it never competes with foreground text. Purely presentational.
 *
 * Stacking differs per page (some heroes sit behind a negative-z background),
 * so the caller passes `className` to control positioning / z-index.
 */
export function TopGlow({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-full"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(74,108,247,0.16) 0%, rgba(74,108,247,0.07) 35%, transparent 72%)",
        }}
      />
    </div>
  );
}
