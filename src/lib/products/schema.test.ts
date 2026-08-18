import { describe, it, expect } from "vitest";
import { parseProduct, parseProducts } from "./schema";
import { isBespoke, isCartable } from "./types";

const images = [{ path: "/a.jpg", alt: "A gown", position: 0 }];
const facets = [
  { facet_values: { facet_key: "silhouette", value: "A-line", slug: "a-line" } },
];

const rtwRow = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "rtw",
  slug: "iris",
  name: "Iris",
  description: null,
  lead_time_note: "Ships in 8–10 weeks",
  badge: "New",
  colour: "Blush",
  price_cents: 240_000,
  price_from_cents: null,
  price_to_cents: null,
  product_images: images,
  product_sizes: [{ label: "AU 8", in_stock: true, position: 1 }],
  product_facet_values: facets,
};

const bespokeRow = {
  id: "22222222-2222-2222-2222-222222222222",
  kind: "bespoke",
  slug: "aurelie",
  name: "Aurélie",
  description: null,
  lead_time_note: "8–12 months",
  badge: null,
  colour: null,
  price_cents: null,
  price_from_cents: 480_000,
  price_to_cents: 620_000,
  product_images: images,
  product_sizes: [],
  product_facet_values: facets,
};

describe("product parsing", () => {
  it("parses a ready-to-wear row into the cartable union member", () => {
    const product = parseProduct(rtwRow);
    expect(product.kind).toBe("rtw");
    expect(isCartable(product)).toBe(true);
    expect(isBespoke(product)).toBe(false);
    if (product.kind === "rtw") {
      expect(product.priceCents).toBe(240_000);
      expect(product.sizes).toEqual([{ label: "AU 8", inStock: true }]);
    }
  });

  it("parses a bespoke row with a range and no price", () => {
    const product = parseProduct(bespokeRow);
    expect(product.kind).toBe("bespoke");
    expect(isBespoke(product)).toBe(true);
    expect(isCartable(product)).toBe(false);
    if (product.kind === "bespoke") {
      expect(product.priceFromCents).toBe(480_000);
      expect(product.priceToCents).toBe(620_000);
    }
    // The purchasable fields are absent, not merely undefined-valued.
    expect("priceCents" in product).toBe(false);
    expect("sizes" in product).toBe(false);
  });

  it("REJECTS a bespoke row carrying a single price", () => {
    // The database CHECK should make this unreachable. If it ever arrives, the
    // boundary must fail loudly rather than yield an object that would render a
    // price tag and a Buy button on a months-long commission.
    expect(() =>
      parseProduct({ ...bespokeRow, price_cents: 500_000 })
    ).toThrow();
  });

  it("REJECTS a ready-to-wear row with no price", () => {
    expect(() => parseProduct({ ...rtwRow, price_cents: null })).toThrow();
  });

  it("REJECTS a row with an unknown kind", () => {
    expect(() => parseProduct({ ...rtwRow, kind: "sample-sale" })).toThrow();
  });

  it("sorts images by position", () => {
    const product = parseProduct({
      ...rtwRow,
      product_images: [
        { path: "/c.jpg", alt: "c", position: 2 },
        { path: "/a.jpg", alt: "a", position: 0 },
        { path: "/b.jpg", alt: "b", position: 1 },
      ],
    });
    expect(product.images.map((i) => i.path)).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });

  it("drops unparseable rows from a list instead of failing the page", () => {
    const parsed = parseProducts([rtwRow, { kind: "rtw", id: "broken" }, bespokeRow]);
    expect(parsed).toHaveLength(2);
  });
});

// ── Live integration ──────────────────────────────────────────────────────
// Proves the schema matches what Supabase actually returns, not just what we
// imagine it returns. Skips when credentials are absent so CI stays green.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

describe.runIf(url && key)("live Supabase rows", () => {
  const SELECT =
    "id,kind,slug,name,description,lead_time_note,badge,colour,price_cents," +
    "price_from_cents,price_to_cents,product_images(path,alt,position)," +
    "product_sizes(label,in_stock,position)," +
    "product_facet_values(facet_values(facet_key,value,slug))";

  it("parses every published product", async () => {
    const res = await fetch(`${url}/rest/v1/products?select=${encodeURIComponent(SELECT)}`, {
      headers: { apikey: key!, Authorization: `Bearer ${key}` },
    });
    expect(res.ok).toBe(true);

    const rows = (await res.json()) as unknown[];
    expect(rows.length).toBeGreaterThan(0);

    // parseProducts silently drops bad rows, so compare counts to catch any
    // row the schema disagrees with.
    const parsed = parseProducts(rows);
    expect(parsed).toHaveLength(rows.length);

    const bespoke = parsed.filter(isBespoke);
    const cartable = parsed.filter(isCartable);
    expect(bespoke.length).toBeGreaterThan(0);
    expect(cartable.length).toBeGreaterThan(0);

    // The invariant, verified against production-shaped data.
    for (const gown of bespoke) {
      expect("priceCents" in gown).toBe(false);
      expect(gown.priceFromCents).toBeGreaterThan(0);
      expect(gown.priceToCents).toBeGreaterThanOrEqual(gown.priceFromCents);
    }
    for (const item of cartable) {
      expect(item.priceCents).toBeGreaterThan(0);
    }
  });
});
