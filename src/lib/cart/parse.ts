import { z } from "zod";

/**
 * The cart payload as it arrives from the browser.
 *
 * This module exists to delete two `as unknown as CartLine[]` casts — one in
 * `api/checkout/route.ts`, one in `actions/cart.ts` — that each laundered a raw
 * request body straight into the branded `CartableId` type. A double cast tells
 * the compiler an id is cart-eligible without anything having checked, which is
 * exactly the guarantee AGENTS.md calls layer one of the two-path model. The
 * same zod schema was also copy-pasted between those two files.
 *
 * The honest model: an id from the wire is a PLAIN STRING. Nothing about a
 * uuid in a request body proves it belongs to a ready-to-wear piece rather than
 * a bespoke gown. It becomes a `CartableId` only after `priceCart` has read the
 * row back with `kind` filtered in SQL — see `cartableIdFromRow` in
 * lib/products/schema.ts.
 *
 * So `RawCartLine` is deliberately unbranded, and the brand is minted later,
 * from evidence, instead of asserted here from nothing.
 *
 * Pure and dependency-light so it can be unit-tested under vitest's node env.
 */

export interface RawCartLine {
  readonly lineId: string;
  /** Unbranded on purpose — see above. Proven cart-eligible only by a query. */
  readonly productId: string;
  readonly size: string;
  readonly qty: number;
}

/** Bounds mirror the database: cart_items.qty is `check (qty > 0 and qty <= 10)`. */
export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 50;

const lineSchema = z.object({
  lineId: z.string().min(1).max(200),
  productId: z.string().uuid(),
  size: z.string().min(1).max(20),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const cartLinesSchema = z.array(lineSchema).max(MAX_LINES);

/**
 * Validates a cart payload. Returns null rather than throwing — both callers
 * turn a bad payload into a response, not an exception.
 */
export function parseCartLines(raw: unknown): RawCartLine[] | null {
  const parsed = cartLinesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
