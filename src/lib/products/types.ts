/**
 * The two-path product model.
 *
 * This is the first of three layers that make it impossible to sell a bespoke
 * gown through the cart. The other two are the Zod boundary (./schema.ts) and
 * the composite foreign key in Postgres (supabase/migrations/...002_commerce).
 * All three must survive any refactor — see AGENTS.md.
 *
 * The rule this encodes: a bespoke wedding gown is a months-long commission
 * involving fittings and a toile. It cannot be added to a cart and paid for in
 * full online, because that is not how the product is delivered. Doing so
 * creates refund and customer-service problems the atelier cannot honour.
 */

// ── Branded ids ───────────────────────────────────────────────────────────
// A plain `string` id would let a gown's id be passed anywhere a dress's id is
// expected. Branding makes the two structurally incompatible: the only way to
// obtain an `RtwId` is to parse a row through ./schema.ts, which checks `kind`.

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type RtwId = Brand<string, "RtwId">;
export type AccessoryId = Brand<string, "AccessoryId">;
export type BespokeId = Brand<string, "BespokeId">;

/** Ids that may legitimately appear in a cart or an order. */
export type CartableId = RtwId | AccessoryId;

export type ProductKind = "rtw" | "accessory" | "bespoke";

// ── Shared shape ──────────────────────────────────────────────────────────

export interface ProductImage {
  readonly path: string;
  readonly alt: string;
  readonly position: number;
}

export interface ProductSize {
  readonly label: string;
  readonly inStock: boolean;
}

export interface FacetAssignment {
  readonly facetKey: string;
  readonly value: string;
  readonly slug: string;
}

interface ProductBase {
  readonly slug: string;
  readonly name: string;
  readonly images: readonly ProductImage[];
  readonly facets: readonly FacetAssignment[];
  readonly leadTimeNote: string | null;
  readonly badge: string | null;
  readonly description: string | null;
}

// ── The three kinds ───────────────────────────────────────────────────────

export interface RtwProduct extends ProductBase {
  readonly kind: "rtw";
  readonly id: RtwId;
  /** GST-inclusive, integer cents. Always shown. */
  readonly priceCents: number;
  readonly colour: string | null;
  readonly sizes: readonly ProductSize[];
}

export interface AccessoryProduct extends ProductBase {
  readonly kind: "accessory";
  readonly id: AccessoryId;
  readonly priceCents: number;
  readonly colour: string | null;
  readonly sizes: readonly ProductSize[];
}

/**
 * Note what is ABSENT: there is no `priceCents` and no `sizes` key at all.
 * `gown.priceCents` is a compile error, not `undefined` at runtime — so a
 * price tag cannot be rendered for a commission even by accident, and no size
 * selector can be built from a gown.
 */
export interface BespokeGown extends ProductBase {
  readonly kind: "bespoke";
  readonly id: BespokeId;
  /** An indicative range only, rendered as "Investment from $X". */
  readonly priceFromCents: number;
  readonly priceToCents: number;
}

export type Product = RtwProduct | AccessoryProduct | BespokeGown;

/** The subset that may be purchased online. */
export type CartableProduct = RtwProduct | AccessoryProduct;

// ── Guards ────────────────────────────────────────────────────────────────

export function isBespoke(product: Product): product is BespokeGown {
  return product.kind === "bespoke";
}

/**
 * Narrows to the purchasable kinds. Use this — not `!isBespoke(p)` — at the
 * boundary of any cart or checkout code, so the narrowing is explicit and a
 * future fourth kind must be classified rather than defaulting to purchasable.
 */
export function isCartable(product: Product): product is CartableProduct {
  return product.kind === "rtw" || product.kind === "accessory";
}

// ── Cart ──────────────────────────────────────────────────────────────────

/**
 * A cart line references a CartableId, so `addToCart(gown, size)` does not
 * type-check.
 *
 * There is deliberately NO price here. The client stores what was chosen, never
 * what it costs: prices are re-read from the database on render and recomputed
 * server-side before any PaymentIntent is created. A cart restored from
 * localStorage weeks later therefore cannot transact at a stale price, and a
 * tampered payload cannot buy a $3,400 gown for $1.
 */
export interface CartLine {
  /** Stable key derived from (productId, size) so lines are addressed by
   *  identity rather than array index — the prototype used indices, which
   *  mutate the wrong line under concurrent updates. */
  readonly lineId: string;
  readonly productId: CartableId;
  readonly size: string;
  readonly qty: number;
}

export function cartLineId(productId: CartableId, size: string): string {
  return `${productId}::${size}`;
}
