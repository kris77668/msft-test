import "server-only";
import { createStaticSupabase } from "@/lib/supabase/static";
import { gstComponent } from "@/lib/money";
import { cartableIdFromRow } from "@/lib/products/schema";
import type { CartableId } from "@/lib/products/types";
import { parseCartLines, type RawCartLine } from "./parse";

/**
 * Server-side cart pricing — THE authoritative total.
 *
 * The browser sends only `{ productId, size, qty }`. Every price is read fresh
 * from the database here, and this result is what the PaymentIntent is created
 * from. A tampered localStorage payload cannot influence the amount charged.
 *
 * The query also filters `kind` to the cart-eligible types, so even a forged
 * product id pointing at a bespoke gown yields nothing to price.
 */

export interface PricedLine {
  lineId: string;
  /**
   * Branded, because by this point the kind has been checked by Postgres —
   * the query filters `kind in ('rtw','accessory')`. This is the only path by
   * which a wire id legitimately becomes a `CartableId`.
   */
  productId: CartableId;
  /**
   * Carried through rather than re-derived by writers.
   *
   * `order_items` and `cart_items` reference products by the COMPOSITE key
   * (id, kind). A writer that assumes 'rtw' produces a foreign key violation
   * for every accessory, because there is no products row at
   * (accessory_id, 'rtw') — which is exactly the bug this field fixes. The
   * value is the kind Postgres returned, so it is the only one that can
   * satisfy that FK.
   */
  kind: "rtw" | "accessory";
  slug: string;
  name: string;
  colour: string | null;
  imagePath: string | null;
  size: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  gstCents: number;
  /** Lines dropped because the product was unpublished or removed. */
  unavailable: string[];
}

/** Free insured shipping across Australia. AU-only at launch. */
export const SHIPPING_CENTS = 0;

/** A cart with nothing in it. Shared so callers agree on the zero case. */
export const EMPTY_CART: PricedCart = {
  lines: [],
  subtotalCents: 0,
  shippingCents: 0,
  totalCents: 0,
  gstCents: 0,
  unavailable: [],
};

/**
 * Prices an unvalidated cart payload.
 *
 * Input arrives from a client — a hand-edited localStorage entry or a crafted
 * request body — so it is parsed before it can reach the database.
 *
 * Malformed input yields an EMPTY cart rather than an error. That is
 * deliberate: the caller's next step is to show a bag, and a corrupted local
 * cart should read as empty rather than break the page. It does mean a client
 * bug looks like an empty bag, so `parseCartLines` returning null is worth
 * logging if that ever needs diagnosing.
 */
export async function priceRawCart(rawLines: unknown): Promise<PricedCart> {
  const lines = parseCartLines(rawLines);
  if (!lines) return EMPTY_CART;

  return priceCart(lines);
}

interface Row {
  id: string;
  kind: "rtw" | "accessory";
  slug: string;
  name: string;
  colour: string | null;
  price_cents: number;
  product_images: { path: string; position: number }[];
}

export async function priceCart(lines: readonly RawCartLine[]): Promise<PricedCart> {
  if (lines.length === 0) return EMPTY_CART;

  const supabase = createStaticSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id, kind, slug, name, colour, price_cents, product_images ( path, position )")
    .in("id", lines.map((l) => l.productId))
    .in("kind", ["rtw", "accessory"]);

  if (error) throw new Error(`priceCart failed: ${error.message}`);

  const byId = new Map((data as unknown as Row[]).map((r) => [r.id, r]));
  const priced: PricedLine[] = [];
  const unavailable: string[] = [];

  for (const line of lines) {
    const row = byId.get(line.productId);

    // Unpublished, deleted, or not cart-eligible. Reported rather than silently
    // dropped, so the customer is told instead of finding their total changed.
    //
    // The `kind` re-check is not redundant with the SQL filter: `data` is cast
    // to Row rather than parsed, so the narrow type is an assertion. Since
    // `kind` is now written to a composite FK it has to be a value we have
    // actually looked at, not one we asserted.
    if (
      !row ||
      typeof row.price_cents !== "number" ||
      (row.kind !== "rtw" && row.kind !== "accessory")
    ) {
      unavailable.push(line.lineId);
      continue;
    }

    const cover = [...(row.product_images ?? [])].sort((a, b) => a.position - b.position)[0];

    priced.push({
      lineId: line.lineId,
      // Safe to brand: `kind` here came back from the filtered query, not the
      // request body.
      productId: cartableIdFromRow(row.id, row.kind),
      kind: row.kind,
      slug: row.slug,
      name: row.name,
      colour: row.colour,
      imagePath: cover?.path ?? null,
      size: line.size,
      qty: line.qty,
      unitPriceCents: row.price_cents,
      lineTotalCents: row.price_cents * line.qty,
    });
  }

  const subtotalCents = priced.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const totalCents = subtotalCents + SHIPPING_CENTS;

  return {
    lines: priced,
    subtotalCents,
    shippingCents: SHIPPING_CENTS,
    totalCents,
    // Prices are GST-inclusive, so this is the component within the total.
    gstCents: gstComponent(totalCents),
    unavailable,
  };
}
