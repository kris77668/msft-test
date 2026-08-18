/**
 * Mirrors Ms Fairy Tale's own photography from msfairytale.com.au into the repo.
 *
 * The design prototype hotlinks every image straight from the live site, which we
 * cannot ship. These are the client's own photographs; this pulls them local so
 * next/image can optimise and serve them.
 *
 * Also reports pixel dimensions, because the open question is whether these
 * web-sized JPEGs are large enough for the full-bleed hero — if not, the original
 * shoot files are needed.
 *
 * Run: node scripts/fetch-images.mjs
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const BASE = "https://www.msfairytale.com.au/Images/Fashion";
const OUT = path.join(process.cwd(), "public", "images", "fashion");
const CONCURRENCY = 5;

/** Zero-pad to width n. */
const pad = (n, width) => String(n).padStart(width, "0");
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Verified against the live /wedding-dress, /evening-dress and /boutique-gallery pages. */
const SETS = [
  {
    prefix: "evening-dress-ms-fairy-tale",
    nums: [...range(1, 14), ...range(50, 62), ...range(70, 78)].map((n) => pad(n, 3)),
  },
  {
    // Note: the prototype references -001 (Aurelie's hero) but the live gallery
    // starts at -002. Included anyway so the 404 is recorded rather than assumed.
    prefix: "wedding-dress-ms-fairy-tale",
    nums: [...range(1, 6), ...range(50, 65), ...range(70, 73)].map((n) => pad(n, 3)),
  },
  {
    prefix: "ms-fairy-tale-dress",
    nums: range(1, 18).map((n) => pad(n, 3)),
  },
  {
    prefix: "fashion-boutique-gallery",
    // 10, 13, 14 and 18 are absent from the live page.
    nums: range(1, 23)
      .filter((n) => ![10, 13, 14, 18].includes(n))
      .map((n) => pad(n, 2)),
  },
];

const targets = SETS.flatMap(({ prefix, nums }) =>
  nums.map((n) => ({ name: `${prefix}-${n}.jpg`, url: `${BASE}/${prefix}-${n}.jpg` }))
);

async function fetchOne({ name, url }) {
  const dest = path.join(OUT, name);

  if (existsSync(dest)) {
    const meta = await sharp(await readFile(dest)).metadata();
    return { name, status: "cached", width: meta.width, height: meta.height };
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return { name, status: `HTTP ${res.status}` };

    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    await writeFile(dest, buf);

    return {
      name,
      status: "ok",
      width: meta.width,
      height: meta.height,
      bytes: buf.length,
    };
  } catch (err) {
    return { name, status: `ERROR ${err.message}` };
  }
}

/** Simple bounded-concurrency pool — polite to the origin, no dependency needed. */
async function pool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      results.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return results;
}

await mkdir(OUT, { recursive: true });
console.log(`Fetching ${targets.length} images to public/images/fashion/ ...\n`);

const results = await pool(targets, CONCURRENCY, fetchOne);

const ok = results.filter((r) => r.status === "ok" || r.status === "cached");
const failed = results.filter((r) => !ok.includes(r));

if (failed.length) {
  console.log("Not retrieved:");
  for (const f of failed) console.log(`  ${f.name.padEnd(38)} ${f.status}`);
  console.log("");
}

const widths = ok.map((r) => r.width).filter(Boolean).sort((a, b) => a - b);
const heights = ok.map((r) => r.height).filter(Boolean);
const totalBytes = ok.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
const smallest = ok.reduce((min, r) => (r.width < min.width ? r : min), ok[0]);
const largest = ok.reduce((max, r) => (r.width > max.width ? r : max), ok[0]);

console.log(`Retrieved ${ok.length}/${targets.length}`);
console.log(`  width   min ${widths[0]}  median ${widths[Math.floor(widths.length / 2)]}  max ${widths.at(-1)}`);
console.log(`  height  min ${Math.min(...heights)}  max ${Math.max(...heights)}`);
console.log(`  smallest: ${smallest.name} (${smallest.width}x${smallest.height})`);
console.log(`  largest:  ${largest.name} (${largest.width}x${largest.height})`);
if (totalBytes) console.log(`  downloaded ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

// A full-bleed hero on a 2x 1440px display wants ~2880px of source width.
// Below ~1600 it will visibly soften on desktop.
const HERO_MIN = 1600;
const tooSmallForHero = ok.filter((r) => r.width && r.width < HERO_MIN);
console.log(
  `\n${tooSmallForHero.length}/${ok.length} images are under ${HERO_MIN}px wide ` +
    `(too soft for a full-bleed hero; fine for grid cards and thumbnails).`
);
