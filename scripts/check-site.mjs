/**
 * Whole-site smoke test against a running server.
 *
 * Checks every route responds, that the two-path rules hold in the rendered
 * HTML, and that structured data says the right thing about each product type.
 *
 * Usage:  npm run dev   (in another terminal)
 *         node scripts/check-site.mjs
 */

const BASE = process.env.SITE ?? "http://localhost:3000";

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const body = res.status < 300 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

/** Every JSON-LD block on a page, parsed. */
function jsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  return blocks
    .map((m) => {
      try {
        return JSON.parse(m[1].replace(/\\u003c/g, "<"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const ROUTES = [
  "/", "/shop", "/bespoke", "/gallery", "/atelier", "/contact", "/faq",
  "/journal", "/quiz", "/testimonials", "/consultation", "/cart", "/checkout",
  "/account", "/privacy", "/terms", "/shipping-returns",
  "/product/iris", "/bespoke/aurelie", "/journal/on-choosing-fabric",
  "/sitemap.xml", "/robots.txt",
];

// ── Every route responds ──────────────────────────────────────────────────
for (const route of ROUTES) {
  const { status } = await get(route);
  check(`GET ${route}`, status === 200, `HTTP ${status}`);
}

// ── 404 behaves ───────────────────────────────────────────────────────────
{
  const { status } = await get("/no-such-page");
  check("GET /no-such-page returns 404", status === 404, `HTTP ${status}`);
}

// ── The two-path rules, in rendered HTML ─────────────────────────────────
{
  const gown = await get("/bespoke/aurelie");
  const hasCart = /Add to Cart/i.test(gown.body);
  const hasSizes = /AU 1[02468]|AU 6/.test(gown.body);
  check("bespoke page has NO 'Add to Cart'", !hasCart, hasCart ? "FOUND CART BUTTON" : "none");
  check("bespoke page has NO size selector", !hasSizes, hasSizes ? "FOUND SIZES" : "none");
  check(
    "bespoke page offers a consultation",
    /Book a Consultation/i.test(gown.body),
    ""
  );

  const rtw = await get("/product/iris");
  check("evening page HAS a cart action", /Add to Cart|Select a Size/i.test(rtw.body), "");
  check("evening page shows a price", /\$2,400/.test(rtw.body), "");
}

// ── Cross-path redirects ─────────────────────────────────────────────────
{
  const a = await get("/product/aurelie");
  check(
    "bespoke gown under /product/ redirects to /bespoke/",
    a.status === 307 && (a.location ?? "").includes("/bespoke/aurelie"),
    `HTTP ${a.status} -> ${a.location ?? "-"}`
  );

  const b = await get("/bespoke/iris");
  check(
    "evening piece under /bespoke/ redirects to /product/",
    b.status === 307 && (b.location ?? "").includes("/product/iris"),
    `HTTP ${b.status} -> ${b.location ?? "-"}`
  );
}

// ── Structured data ──────────────────────────────────────────────────────
{
  const rtw = jsonLd((await get("/product/iris")).body);
  const product = rtw.find((b) => b["@type"] === "Product");
  check("evening page emits Product schema", Boolean(product), product ? "" : "missing");
  check(
    "  …with an Offer and AUD price",
    product?.offers?.priceCurrency === "AUD" && Boolean(product?.offers?.price),
    product?.offers?.price ? `price ${product.offers.price}` : "missing"
  );

  const bespoke = jsonLd((await get("/bespoke/aurelie")).body);
  const asProduct = bespoke.find((b) => b["@type"] === "Product");
  const asService = bespoke.find((b) => b["@type"] === "Service");

  // The critical rule: an Offer with a price on a commission would imply it can
  // be bought today, and can surface a buy button in Google Shopping.
  check(
    "bespoke page does NOT emit Product schema",
    !asProduct,
    asProduct ? "EMITS Product — would imply purchasable" : "correct"
  );
  check("bespoke page emits Service schema", Boolean(asService), asService ? "" : "missing");
  check(
    "  …with a price RANGE, not a single price",
    Boolean(asService?.offers?.priceSpecification?.minPrice) &&
      Boolean(asService?.offers?.priceSpecification?.maxPrice),
    asService?.offers?.priceSpecification
      ? `${asService.offers.priceSpecification.minPrice}–${asService.offers.priceSpecification.maxPrice}`
      : "missing"
  );

  const home = jsonLd((await get("/")).body);
  const org = home.find((b) => String(b["@type"]).includes("Organization"));
  check("Organization/LocalBusiness schema present", Boolean(org), "");

  const faq = jsonLd((await get("/faq")).body);
  check("FAQPage schema present", faq.some((b) => b["@type"] === "FAQPage"), "");

  const article = jsonLd((await get("/journal/on-choosing-fabric")).body);
  check("Article schema present", article.some((b) => b["@type"] === "Article"), "");
}

// ── Faceted indexing policy ──────────────────────────────────────────────
{
  const single = await get("/shop?fabric=velvet");
  const multi = await get("/shop?fabric=velvet&silhouette=mermaid");
  const noindex = (html) => /<meta name="robots" content="[^"]*noindex/i.test(html);

  check("single-facet URL stays indexable", !noindex(single.body), "");
  check("multi-facet URL is noindex", noindex(multi.body), noindex(multi.body) ? "" : "MISSING noindex");
}

// ── Sitemap and robots ───────────────────────────────────────────────────
{
  const sitemap = (await get("/sitemap.xml")).body;
  const count = (sitemap.match(/<loc>/g) ?? []).length;
  check("sitemap lists pages", count > 25, `${count} URLs`);
  check(
    "sitemap excludes checkout",
    !/\/checkout|\/cart</.test(sitemap),
    /\/checkout/.test(sitemap) ? "LEAKED checkout" : "correct"
  );

  const robots = (await get("/robots.txt")).body;
  check("robots disallows checkout", /Disallow: \/checkout/.test(robots), "");
  check("robots references sitemap", /Sitemap:/.test(robots), "");
}

// ── Accessibility basics ─────────────────────────────────────────────────
{
  const html = (await get("/product/iris")).body;
  const imgs = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  const missingAlt = imgs.filter((tag) => !/\salt="/.test(tag));
  check("every <img> has an alt attribute", missingAlt.length === 0, `${imgs.length} images, ${missingAlt.length} missing`);

  const h1s = (html.match(/<h1[\s>]/g) ?? []).length;
  check("exactly one <h1>", h1s === 1, `${h1s} found`);

  check("html lang is en-AU", /<html[^>]*lang="en-AU"/.test(html), "");
}

// ── Report ───────────────────────────────────────────────────────────────
for (const { name, pass, detail } of results) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name.padEnd(52)} ${detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
