import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "features");
mkdirSync(OUT_DIR, { recursive: true });

const items = [
  ["recruiter-dashboard", "Recruiter Dashboard"],
  ["ai-resume-parsing", "AI Resume Parsing"],
  ["ai-job-matching", "AI Job Matching & Scoring"],
  ["human-review-pipeline", "Human Review & Pipeline"],
  ["automated-scheduling-ats", "Automated Scheduling & ATS Sync"],
  ["easy-profile-apply", "Easy Profile & One-Click Apply"],
  ["multiple-recruiters-roles", "Access to Multiple Recruiters"],
  ["realtime-status", "Real-Time Status"],
];

const W = 1200;
const H = 900;
const esc = (s) => s.replace(/&/g, "&amp;");

for (const [file, label] of items) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#4A6CF7"/>
        <stop offset="100%" stop-color="#3B5BF6"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${W * 0.78}" cy="${H * 0.24}" r="220" fill="#ffffff" opacity="0.06"/>
    <circle cx="${W * 0.2}" cy="${H * 0.8}" r="180" fill="#ffffff" opacity="0.05"/>
    <text x="50%" y="46%" font-family="Poppins, Arial, sans-serif" font-size="30" fill="#ffffff" opacity="0.55" text-anchor="middle" letter-spacing="4">PLACEHOLDER</text>
    <text x="50%" y="54%" font-family="Poppins, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(label)}</text>
  </svg>`;
  const out = join(OUT_DIR, `${file}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log("wrote", `${file}.png`);
}
