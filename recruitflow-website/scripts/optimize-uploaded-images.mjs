import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUB = join(__dirname, "..", "public");

// [sourceFile, outputWebp, maxWidth] — source heading-named uploads → the
// kebab-case names the components already reference, as optimized .webp.
const JOBS = [
  // Features (rendered inside narrow gallery panels → 1100px is plenty @2x)
  ["features/Recruiter Dashboard.png",                  "features/recruiter-dashboard.webp",     1100],
  ["features/ai-resume-parsing.png",                    "features/ai-resume-parsing.webp",       1100],
  ["features/AI-Job-Matching & Candidate-Scoring.png",  "features/ai-job-matching.webp",         1100],
  ["features/Human-Review-&-Hiring-Pipeline.png",       "features/human-review-pipeline.webp",   1100],
  ["features/Automated-Scheduling-ATS-Sync.png",        "features/automated-scheduling-ats.webp",1100],
  ["features/Easy-Profile-and-One-click-apply.png",     "features/easy-profile-apply.webp",      1100],
  ["features/Access-to-Multiple-Recruiters-Roles.png",  "features/multiple-recruiters-roles.webp",1100],
  ["features/Real-Time-Status-&-Fastest-Response.png",  "features/realtime-status.webp",         1100],
  // About (rendered ~45vw in a rounded frame → 1200px covers @2x desktop)
  ["about/About-Section-1.png", "about/about-overview.webp", 1200],
  ["about/About-Section-2.png", "about/about-portals.webp",  1200],
  ["about/About-Section-3.png", "about/about-why.webp",      1200],
  // CTA (full-width banner background, max-w 1600px → 1600px covers desktop)
  ["cta-card/Start Hiring Smarter-today-CTA.png", "cta-card/cta-bg.webp", 1600],
];

let total = 0;
for (const [src, out, maxW] of JOBS) {
  const srcPath = join(PUB, src);
  if (!existsSync(srcPath)) {
    console.log("SKIP (missing):", src);
    continue;
  }
  const before = statSync(srcPath).size;
  const info = await sharp(srcPath, { limitInputPixels: false })
    .resize({ width: maxW, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(join(PUB, out));
  total += info.size;
  const kb = (n) => Math.round((n / 1024) * 10) / 10;
  console.log(
    `${out}  ${info.width}x${info.height}  ${kb(before)}KB -> ${kb(info.size)}KB`
  );
}
console.log("total webp size:", Math.round((total / 1024) * 10) / 10 + "KB");
