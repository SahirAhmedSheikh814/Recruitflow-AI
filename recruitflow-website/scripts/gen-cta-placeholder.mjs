import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "cta-card");
mkdirSync(OUT_DIR, { recursive: true });

const W = 1600;
const H = 720;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4A6CF7"/>
      <stop offset="100%" stop-color="#2B3EB0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="${W * 0.82}" cy="${H * 0.28}" r="260" fill="#ffffff" opacity="0.06"/>
  <circle cx="${W * 0.7}" cy="${H * 0.75}" r="180" fill="#ffffff" opacity="0.05"/>
  <text x="50%" y="50%" font-family="Poppins, Arial, sans-serif" font-size="34" fill="#ffffff" opacity="0.5" text-anchor="middle" letter-spacing="6">CTA BACKGROUND PLACEHOLDER</text>
</svg>`;

const out = join(OUT_DIR, "cta-bg.png");
await sharp(Buffer.from(svg)).png().toFile(out);
console.log("wrote public/cta-card/cta-bg.png");
