import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "about");
mkdirSync(OUT, { recursive: true });

const W = 800, H = 600;
const P = "#4A6CF7";

const images = [
  { file: "about-overview.png",  label: "About RecruitFlow AI",       bg: "#EEF1FE" },
  { file: "about-portals.png",   label: "One Platform, Three Portals", bg: "#F0F4FF" },
  { file: "about-why.png",       label: "Why Choose RecruitFlow AI",   bg: "#EDF0FE" },
];

for (const { file, label, bg } of images) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>
    <circle cx="${W*0.72}" cy="${H*0.3}" r="180" fill="${P}" opacity="0.07"/>
    <circle cx="${W*0.2}"  cy="${H*0.75}" r="120" fill="${P}" opacity="0.05"/>
    <rect x="${W*0.3}" y="${H*0.35}" width="${W*0.4}" height="${H*0.3}" rx="12"
          fill="none" stroke="${P}" stroke-width="1.5" opacity="0.2"/>
    <text x="50%" y="46%" font-family="Arial,sans-serif" font-size="18"
          fill="${P}" opacity="0.45" text-anchor="middle" font-weight="600">${label}</text>
    <text x="50%" y="56%" font-family="Arial,sans-serif" font-size="13"
          fill="#64748b" opacity="0.6" text-anchor="middle">Photo placeholder — replace with real image</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(join(OUT, file));
  console.log("wrote", file);
}
