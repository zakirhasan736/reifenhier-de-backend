
import fs from "fs";
import path from "path";
import slugify from "./slugify.js";

const EXT = ["webp", "png", "jpg", "jpeg", "svg"];

/** Explicit merchant_name → filename slug overrides */
const LOGO_ALIASES = {
  "reifen de": "reifen-de",
  "reifen.de": "reifen-de",
  "reifende": "reifen-de",
  "reifen.com": "reifen-com",
  "reifen24 de": "reifen24-de",
  "reifen24.de": "reifen24-de",
  "reifendirekt.de": "reifendirekt-de",
  "giga tyres eu": "giga-tyres-eu",
  "giga reifen": "giga-tyres-eu",
  "tyrigo de": "tyrigo-de",
  "vergölst de": "vergoelst-de",
  "vergoelst de": "vergoelst-de",
  "vergoelst.de": "vergoelst-de",
};

/**
 * Looks up the logo path for vendors/brands under src/images/{type}/.
 * Returns a frontend-relative path like /images/vendors/reifen-de.png
 */
export function findLogo(type, name) {
  if (!name) return "";

  const lower = String(name).trim().toLowerCase();
  const slug = LOGO_ALIASES[lower] || slugify(name);

  for (const ext of EXT) {
    const localPath = path.join(process.cwd(), "src", "images", type, `${slug}.${ext}`);
    if (fs.existsSync(localPath)) {
      return `/images/${type}/${slug}.${ext}`;
    }
  }

  return "";
}
