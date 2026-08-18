/**
 * Mobile verification at 375px — iPhone SE, the narrowest device worth designing for.
 *
 * Most bridal traffic arrives from Instagram on a phone, so this is the primary
 * viewport rather than an afterthought.
 *
 * Checks the two things that actually break on narrow screens:
 *   - horizontal overflow (any element wider than the viewport)
 *   - tap targets below the 44px minimum
 *
 * Usage:  npm run dev   (in another terminal)
 *         node scripts/check-mobile.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.SITE ?? "http://localhost:3000";
const VIEWPORT = { width: 375, height: 667 };
const MIN_TAP = 44;

const ROUTES = [
  "/", "/shop", "/bespoke", "/product/iris", "/bespoke/aurelie",
  "/gallery", "/journal", "/journal/on-choosing-fabric", "/faq",
  "/contact", "/consultation", "/quiz", "/cart", "/atelier",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

const results = [];

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });

  const report = await page.evaluate((minTap) => {
    const docWidth = document.documentElement.clientWidth;

    // Elements extending past the viewport. Fixed/sticky items and anything
    // deliberately clipped by an ancestor are excluded — they don't cause the
    // page itself to scroll sideways.
    const overflowing = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0) return false;
        const style = getComputedStyle(el);
        if (style.position === "fixed") return false;
        if (style.overflowX === "auto" || style.overflowX === "scroll") return false;
        return rect.right > docWidth + 1;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);

    // Interactive elements too small to hit reliably with a thumb.
    const small = [...document.querySelectorAll("a, button, input, select, [role=button]")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false; // hidden
        // Deliberately unreachable: honeypot fields and anything hidden from
        // assistive tech is not a target a person can tap.
        if (el.getAttribute("tabindex") === "-1") return false;
        if (el.closest("[aria-hidden=true]")) return false;
        // Inline links inside prose are exempt — they're read, not tapped as targets.
        const inProse = el.closest("p, li, dd, blockquote");
        if (inProse && el.tagName === "A") return false;
        return rect.height < minTap;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().height)}px`);

    return {
      scrollsSideways: document.documentElement.scrollWidth > docWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
      docWidth,
      overflowing,
      small,
    };
  }, MIN_TAP);

  results.push({ route, ...report });
}

await browser.close();

let failures = 0;

for (const r of results) {
  const overflowOk = !r.scrollsSideways;
  const tapOk = r.small.length === 0;
  if (!overflowOk || !tapOk) failures++;

  console.log(
    `  ${overflowOk && tapOk ? "PASS" : "FAIL"}  ${r.route.padEnd(34)} ` +
      `width ${r.scrollWidth}/${r.docWidth}` +
      (overflowOk ? "" : `  OVERFLOW: ${r.overflowing.join(", ")}`) +
      (tapOk ? "" : `  SMALL TAPS: ${r.small.join(" | ")}`)
  );
}

console.log(
  `\n${results.length - failures}/${results.length} routes clean at ${VIEWPORT.width}px.`
);
if (failures) process.exitCode = 1;
