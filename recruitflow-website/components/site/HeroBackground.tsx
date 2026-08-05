"use client";

import { TopGlow } from "./TopGlow";

const css = `
@keyframes hb-orb-1 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(-28px,-18px) scale(1.06); }
  66%      { transform: translate(18px,14px) scale(0.96); }
}
@keyframes hb-orb-2 {
  0%,100% { transform: translate(0,0) scale(1); }
  40%     { transform: translate(22px,-26px) scale(1.09); }
  70%     { transform: translate(-14px,18px) scale(0.94); }
}
@keyframes hb-spin   { to { transform: rotate(360deg);  } }
@keyframes hb-unspin { to { transform: rotate(-360deg); } }
@keyframes hb-float {
  0%,100% { transform: translateY(0)    rotate(0deg);  }
  50%     { transform: translateY(-16px) rotate(8deg); }
}
@keyframes hb-pulse {
  0%,100% { opacity:.35; } 50% { opacity:.7; }
}
@media (prefers-reduced-motion:reduce) {
  .hb-anim { animation:none !important; }
}
`;

const P = "rgba(74,108,247,";

export function HeroBackground() {
  return (
    <>
      <style>{css}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">

        {/* Base — clean white left, faint blue tint right */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-[#eef1fe]" />

        {/* Soft primary light shining down from the very top of the page */}
        <TopGlow />

        {/* Dot grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle,${P}0.18) 1px,transparent 1px)`,
          backgroundSize: "30px 30px",
        }} />

        {/* Large primary orb */}
        <div className="hb-anim absolute" style={{
          right: "-4%", top: "0%",
          width: "58%", height: "95%",
          background: `radial-gradient(ellipse at 40% 40%,${P}0.13) 0%,${P}0.06) 45%,transparent 70%)`,
          filter: "blur(48px)",
          animation: "hb-orb-1 13s ease-in-out infinite",
        }} />

        {/* Secondary orb */}
        <div className="hb-anim absolute" style={{
          right: "8%", top: "38%",
          width: "36%", height: "62%",
          background: `radial-gradient(ellipse at center,${P}0.10) 0%,transparent 65%)`,
          filter: "blur(32px)",
          animation: "hb-orb-2 18s ease-in-out infinite",
        }} />

        {/* Ring 1 — medium, clockwise */}
        <div className="hb-anim absolute rounded-full" style={{
          right: "16%", top: "12%",
          width: 300, height: 300,
          border: `1.5px solid ${P}0.14)`,
          animation: "hb-spin 32s linear infinite",
        }}>
          <span className="absolute rounded-full" style={{
            top: -5, left: "50%", transform: "translateX(-50%)",
            width: 10, height: 10,
            background: `${P}0.55)`,
            boxShadow: `0 0 8px 2px ${P}0.3)`,
          }} />
        </div>

        {/* Ring 2 — large, counter-clockwise */}
        <div className="hb-anim absolute rounded-full" style={{
          right: "9%", top: "4%",
          width: 480, height: 480,
          border: `1px solid ${P}0.08)`,
          animation: "hb-unspin 50s linear infinite",
        }}>
          <span className="absolute rounded-full" style={{
            bottom: -4, left: "28%",
            width: 7, height: 7,
            background: `${P}0.38)`,
          }} />
          <span className="absolute rounded-full" style={{
            top: "30%", right: -4,
            width: 5, height: 5,
            background: `${P}0.28)`,
          }} />
        </div>

        {/* Ring 3 — small inner, clockwise fast */}
        <div className="hb-anim absolute rounded-full" style={{
          right: "24%", top: "28%",
          width: 140, height: 140,
          border: `1px dashed ${P}0.18)`,
          animation: "hb-spin 18s linear infinite",
        }} />

        {/* Floating shapes */}
        {([
          { r:"30%", t:"20%", s:14, br:"50%",   delay:"0s",   dur:"6s"  },
          { r:"44%", t:"52%", s: 9, br:"50%",   delay:"1.2s", dur:"8s"  },
          { r:"19%", t:"62%", s:11, br:"3px",   delay:"2s",   dur:"7s"  },
          { r:"38%", t:"72%", s: 7, br:"50%",   delay:"0.6s", dur:"9s"  },
          { r:"52%", t:"35%", s: 6, br:"2px",   delay:"1.8s", dur:"5.5s"},
        ] as const).map(({ r, t, s, br, delay, dur }, i) => (
          <div key={i} className="hb-anim absolute" style={{
            right: r, top: t,
            width: s, height: s,
            background: `${P}${0.22 + i * 0.04})`,
            borderRadius: br,
            animation: `hb-float ${dur} ease-in-out infinite ${delay}`,
          }} />
        ))}

        {/* Pulsing accent dots */}
        {([
          { r:"25%", t:"44%", dur:"3.2s", delay:"0s"   },
          { r:"33%", t:"60%", dur:"4s",   delay:"0.5s" },
          { r:"48%", t:"25%", dur:"3.6s", delay:"1s"   },
          { r:"56%", t:"48%", dur:"4.4s", delay:"0.3s" },
          { r:"41%", t:"78%", dur:"3s",   delay:"1.4s" },
        ] as const).map(({ r, t, dur, delay }, i) => (
          <div key={i} className="hb-anim absolute rounded-full" style={{
            right: r, top: t,
            width: 5, height: 5,
            background: `${P}${0.3 + i * 0.05})`,
            animation: `hb-pulse ${dur} ease-in-out infinite ${delay}`,
          }} />
        ))}

        {/* Soft left-edge fade so text area stays crisp white */}
        <div className="absolute inset-y-0 left-0 w-[48%]" style={{
          background: "linear-gradient(to right,rgba(255,255,255,1) 0%,rgba(255,255,255,0.85) 60%,rgba(255,255,255,0) 100%)",
        }} />
      </div>
    </>
  );
}
