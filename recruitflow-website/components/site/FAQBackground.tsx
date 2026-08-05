/**
 * FAQ page decorative background (PRD §3/§4). A soft brand-blue gradient with
 * scattered floating dots and a couple of thin diagonal accent lines — the same
 * decorative language used on the Hero and About sections, in brand blue rather
 * than the reference's pastel multi-color palette. Purely decorative.
 */
import { TopGlow } from "./TopGlow";

const P = "rgba(74,108,247,";

// Scattered floating dots — {left/right, top/bottom, size px, opacity}.
const DOTS = [
  { left: "6%", top: "22%", size: 26, o: 0.18 },
  { left: "18%", top: "48%", size: 16, o: 0.28 },
  { left: "10%", top: "72%", size: 12, o: 0.22 },
  { right: "8%", top: "16%", size: 34, o: 0.14 },
  { right: "14%", top: "40%", size: 14, o: 0.3 },
  { right: "6%", top: "62%", size: 20, o: 0.2 },
  { left: "44%", top: "8%", size: 12, o: 0.25 },
  { right: "30%", top: "82%", size: 18, o: 0.16 },
] as const;

export function FAQBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Soft primary light shining down from the very top of the page */}
      <TopGlow />

      {/* Soft brand-blue gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 82% 12%, rgba(74,108,247,0.12) 0%, rgba(74,108,247,0.04) 45%, #ffffff 78%), radial-gradient(60% 55% at 10% 90%, rgba(74,108,247,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Thin diagonal accent lines */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <line x1="0%" y1="12%" x2="100%" y2="46%" stroke={`${P}0.08)`} strokeWidth="1" />
        <line x1="100%" y1="4%" x2="35%" y2="100%" stroke={`${P}0.06)`} strokeWidth="1" />
      </svg>

      {/* Floating dots */}
      {DOTS.map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: "left" in d ? d.left : undefined,
            right: "right" in d ? d.right : undefined,
            top: d.top,
            width: d.size,
            height: d.size,
            background: `${P}${d.o})`,
          }}
        />
      ))}
    </div>
  );
}
