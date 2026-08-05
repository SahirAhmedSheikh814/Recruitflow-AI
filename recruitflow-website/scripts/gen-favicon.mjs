import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "public", "Logos", "Pictorial-Logo.png");
const OUT = join(__dirname, "..", "app", "icon.png");

await sharp(SRC, { limitInputPixels: false })
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log("wrote app/icon.png", meta.width + "x" + meta.height, meta.format);
