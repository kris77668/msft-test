import type { PricedLine } from "./pricing";

/**
 * Builds the `order_items` rows for a priced cart.
 *
 * Extracted from the checkout route so it can be unit-tested without a
 * database, following the same reasoning as ./parse.ts. The bug it exists to
 * prevent was invisible in a type check and needed a live accessory to expose:
 *
 *   product_kind: "rtw",   // ← for EVERY line, including accessories
 *
 * `order_items` references products by the composite key (product_id,
 * product_kind), so an accessory written as 'rtw' has no row to point at.
 * Postgres raised a foreign key violation (23503), the checkout route's error
 * path cancelled the order, and the customer saw "Could not create order" with
 * no indication of why. Every accessory in the catalogue was unsellable.
 *
 * The kind must therefore come from the priced line — which carries the value
 * Postgres returned — and never from a literal here.
 *
 * Line snapshots are copied rather than referenced: an order must remain a
 * faithful record of what was bought at what price even after the product is
 * renamed, repriced or archived.
 */
export interface OrderItemRow {
  order_id: string;
  product_id: string;
  product_kind: "rtw" | "accessory";
  product_name: string;
  product_slug: string;
  image_path: string | null;
  colour: string | null;
  size: string;
  unit_price_cents: number;
  qty: number;
}

export function orderItemRows(
  orderId: string,
  lines: readonly PricedLine[]
): OrderItemRow[] {
  return lines.map((line) => ({
    order_id: orderId,
    product_id: line.productId,
    // From the line, never a literal. See the header comment.
    product_kind: line.kind,
    product_name: line.name,
    product_slug: line.slug,
    image_path: line.imagePath,
    colour: line.colour,
    size: line.size,
    unit_price_cents: line.unitPriceCents,
    qty: line.qty,
  }));
}
