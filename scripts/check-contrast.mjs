/**
 * WCAG contrast audit for the Whispered palette.
 *
 * The design direction is locked, and two of its accent colours fail AA when used
 * for small text on cream. This script proves which ones fail and derives darkened
 * variants that pass, preserving hue by scaling RGB toward black.
 *
 * Run: node scripts/check-contrast.mjs
 */

const PALETTE = {
  cream: "#faf6ef",
  paper: "#f5ede2",
  blush: "#f3e3df",
  rose: "#d4a59a",
  dusty: "#b88a7e",
  mocha: "#3d2e26",
  ink: "#2a201b",
  gold: "#b8956a",
  error: "#c14f47",
};

const BACKGROUNDS = { cream: "#faf6ef", paper: "#f5ede2", ink: "#2a201b" };

const AA_NORMAL = 4.5; // text under 24px (or under 19px bold)
const AA_LARGE = 3.0; // 24px+, or 19px+ bold

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};

const rgbToHex = (rgb) =>
  "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** WCAG 2.x relative luminance. */
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (fg, bg) => {
  const [l1, l2] = [luminance(hexToRgb(fg)), luminance(hexToRgb(bg))];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
};

/** Scale a colour toward black until it meets `target` contrast on `bg`. */
const darkenToMeet = (hex, bg, target) => {
  const rgb = hexToRgb(hex);
  for (let k = 100; k >= 0; k--) {
    const candidate = rgbToHex(rgb.map((c) => (c * k) / 100));
    if (contrast(candidate, bg) >= target) return { hex: candidate, ratio: contrast(candidate, bg) };
  }
  return { hex: "#000000", ratio: contrast("#000000", bg) };
};

console.log("Contrast on cream (#faf6ef) — AA normal text needs 4.5:1\n");
let failures = 0;
for (const [name, hex] of Object.entries(PALETTE)) {
  if (name === "cream") continue;
  const ratio = contrast(hex, BACKGROUNDS.cream);
  const normal = ratio >= AA_NORMAL ? "PASS" : "FAIL";
  const large = ratio >= AA_LARGE ? "PASS" : "FAIL";
  if (ratio < AA_NORMAL) failures++;
  console.log(
    `  ${name.padEnd(7)} ${hex}  ${ratio.toFixed(2).padStart(6)}:1   normal ${normal}   large ${large}`
  );
}

console.log("\nDerived accessible variants (hue-preserving, AA normal on cream):\n");
for (const name of ["dusty", "gold", "rose", "error"]) {
  const { hex, ratio } = darkenToMeet(PALETTE[name], BACKGROUNDS.cream, AA_NORMAL);
  console.log(`  ${name}-text  ${hex}  ${ratio.toFixed(2)}:1`);
}

console.log("\nOn ink (#2a201b), for footer/dark sections:\n");
for (const name of ["cream", "paper", "gold", "dusty", "rose"]) {
  const ratio = contrast(PALETTE[name], BACKGROUNDS.ink);
  console.log(
    `  ${name.padEnd(7)} ${ratio.toFixed(2).padStart(6)}:1   ${ratio >= AA_NORMAL ? "PASS" : "FAIL"}`
  );
}

console.log(
  `\n${failures} palette colour(s) fail AA for normal text on cream — use the *-text variants under 24px.`
);
