import { describe, it, expect, vi, beforeEach } from "vitest";
import { gstComponent } from "@/lib/money";

/**
 * Server-side cart pricing — the authoritative total a PaymentIntent is built
 * from. These assert the behaviour the checkout route depends on: prices come
 * from the row (never the request), a piece that can't be priced is REPORTED
 * (not silently dropped, which once let a customer be charged for a smaller
 * order than they reviewed), a forged non-cart kind yields nothing, and the
 * cover image is the lowest-position one.
 */

vi.mock("server-only", () => ({}));

let mockRows: unknown[] = [];
let mockError: unknown = null;
vi.mock("@/lib/supabase/static", () => ({
  createStaticSupabase: () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.in = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: mockRows, error: mockError }).then(resolve);
    return { from: () => chain };
  },
}));

import { priceCart, priceRawCart, EMPTY_CART } from "./pricing";
import type { RawCartLine } from "./parse";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const line = (over: Partial<RawCartLine> = {}): RawCartLine => ({
  lineId: "l1",
  productId: ID_A,
  size: "10",
  qty: 1,
  ...over,
});

const rtwRow = (over: Record<string, unknown> = {}) => ({
  id: ID_A,
  kind: "rtw",
  slug: "aria",
  name: "Aria Gown",
  colour: "ivory",
  price_cents: 240000,
  product_images: [{ path: "aria.jpg", position: 0 }],
  ...over,
});

beforeEach(() => {
  mockRows = [];
  mockError = null;
});

describe("priceCart", () => {
  it("prices a line from the database row and computes GST from the total", async () => {
    mockRows = [rtwRow()];
    const cart = await priceCart([line({ qty: 2 })]);

    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.unitPriceCents).toBe(240000);
    expect(cart.lines[0]!.lineTotalCents).toBe(480000);
    expect(cart.subtotalCents).toBe(480000);
    expect(cart.totalCents).toBe(480000);
    expect(cart.gstCents).toBe(gstComponent(480000));
    expect(cart.unavailable).toEqual([]);
  });

  it("reports a line whose product is not returned, rather than dropping it", async () => {
    mockRows = []; // archived / unpublished mid-checkout
    const cart = await priceCart([line({ lineId: "gone" })]);

    expect(cart.lines).toHaveLength(0);
    expect(cart.unavailable).toEqual(["gone"]);
  });

  it("prices the available lines and reports only the missing one", async () => {
    mockRows = [rtwRow()];
    const cart = await priceCart([
      line({ lineId: "keep", productId: ID_A }),
      line({ lineId: "drop", productId: ID_B }),
    ]);

    expect(cart.lines.map((l) => l.lineId)).toEqual(["keep"]);
    expect(cart.unavailable).toEqual(["drop"]);
  });

  it("treats a non-cart kind as unavailable even if a row comes back", async () => {
    // The SQL filters kind, but priceCart re-checks because the row is asserted,
    // not parsed — a bespoke row must never mint a CartableId.
    mockRows = [rtwRow({ kind: "bespoke" })];
    const cart = await priceCart([line()]);

    expect(cart.lines).toHaveLength(0);
    expect(cart.unavailable).toEqual(["l1"]);
  });

  it("uses the lowest-position image as the cover", async () => {
    mockRows = [
      rtwRow({
        product_images: [
          { path: "back.jpg", position: 2 },
          { path: "front.jpg", position: 1 },
        ],
      }),
    ];
    const cart = await priceCart([line()]);
    expect(cart.lines[0]!.imagePath).toBe("front.jpg");
  });

  it("returns the shared empty cart for no lines", async () => {
    expect(await priceCart([])).toBe(EMPTY_CART);
  });

  it("throws if the query itself errors", async () => {
    mockError = { message: "boom" };
    await expect(priceCart([line()])).rejects.toThrow(/priceCart failed/);
  });
});

describe("priceRawCart", () => {
  it("returns an empty cart for a malformed payload rather than throwing", async () => {
    expect(await priceRawCart("not-an-array")).toBe(EMPTY_CART);
    expect(await priceRawCart([{ productId: "not-a-uuid" }])).toBe(EMPTY_CART);
  });

  it("parses then prices a well-formed payload", async () => {
    mockRows = [rtwRow()];
    const cart = await priceRawCart([
      { lineId: "l1", productId: ID_A, size: "10", qty: 1 },
    ]);
    expect(cart.lines).toHaveLength(1);
    expect(cart.totalCents).toBe(240000);
  });
});
