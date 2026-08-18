import { describe, it, expect } from "vitest";
import { orderItemRows } from "./order-items";
import type { PricedLine } from "./pricing";
import type { CartableId } from "@/lib/products/types";

/**
 * Regression guard for the composite foreign key on order_items.
 *
 * order_items references products by (product_id, product_kind). The checkout
 * route used to write `product_kind: "rtw"` for every line, so an accessory —
 * whose products row is kind 'accessory' — had nothing to reference. Postgres
 * rejected the insert with a foreign key violation, the order was cancelled,
 * and the customer got a generic "Could not create order". Accessories were
 * unsellable, and nothing in the type system or the test suite noticed.
 *
 * This was live, not theoretical. `supabase/seed.sql` still carries both
 * accessories as `status = 'draft'`, but in the database they are `published` —
 * someone published them through the Supabase table editor, exactly as
 * docs/EDITING-CONTENT.md instructs. So the catalogue offered a Cathedral Veil
 * and Opera Gloves that could be added to a bag and never bought, and the code
 * that broke them shipped looking correct.
 *
 * That is the shape of the risk worth remembering: a content edit, with no code
 * change and no failing test, was enough to make a product unsellable.
 */

function line(overrides: Partial<PricedLine> = {}): PricedLine {
  return {
    lineId: "p1::AU 8",
    productId: "00000000-0000-0000-0000-000000000001" as CartableId,
    kind: "rtw",
    slug: "iris",
    name: "Iris",
    colour: "Blush",
    imagePath: "/images/iris.jpg",
    size: "AU 8",
    qty: 1,
    unitPriceCents: 240_000,
    lineTotalCents: 240_000,
    ...overrides,
  };
}

describe("orderItemRows", () => {
  it("writes an accessory as 'accessory', not 'rtw'", () => {
    // THE regression. A veil written as 'rtw' violates the composite FK.
    const rows = orderItemRows("order-1", [line({ kind: "accessory", slug: "veil-cathedral" })]);

    expect(rows[0]?.product_kind).toBe("accessory");
  });

  it("keeps each line's own kind in a mixed bag", () => {
    // A gown and a veil in one order is the case that made the bug intermittent:
    // an all-ready-to-wear cart succeeded, so the failure looked random.
    const rows = orderItemRows("order-1", [
      line({ lineId: "a", kind: "rtw" }),
      line({ lineId: "b", kind: "accessory" }),
      line({ lineId: "c", kind: "rtw" }),
    ]);

    expect(rows.map((r) => r.product_kind)).toEqual(["rtw", "accessory", "rtw"]);
  });

  it("never emits a kind the FK cannot satisfy", () => {
    // 'bespoke' must be unreachable here: PricedLine's type forbids it, and
    // order_items carries CHECK (product_kind <> 'bespoke') besides. This
    // asserts the values actually produced stay inside the cartable set.
    const rows = orderItemRows("order-1", [
      line({ kind: "rtw" }),
      line({ kind: "accessory" }),
    ]);

    for (const row of rows) {
      expect(["rtw", "accessory"]).toContain(row.product_kind);
    }
  });

  it("snapshots price, name and slug per line", () => {
    const rows = orderItemRows("order-1", [
      line({ name: "Ember", slug: "ember", unitPriceCents: 180_000, qty: 2 }),
    ]);

    expect(rows[0]).toMatchObject({
      order_id: "order-1",
      product_name: "Ember",
      product_slug: "ember",
      unit_price_cents: 180_000,
      qty: 2,
    });
  });

  it("passes a missing image through as null rather than undefined", () => {
    // undefined would be omitted from the JSON body and let the column default
    // apply; null is an explicit "this product has no imagery".
    const rows = orderItemRows("order-1", [line({ imagePath: null, colour: null })]);

    expect(rows[0]?.image_path).toBeNull();
    expect(rows[0]?.colour).toBeNull();
  });

  it("returns no rows for an empty cart", () => {
    expect(orderItemRows("order-1", [])).toEqual([]);
  });
});
