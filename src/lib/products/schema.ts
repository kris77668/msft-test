import { z } from "zod";
import type {
  AccessoryId,
  BespokeId,
  CartableId,
  Product,
  RtwId,
} from "./types";

/**
 * The parsing boundary — layer two of the two-path guarantee.
 *
 * Supabase hands back loosely-typed JSON. Generated database types describe the
 * table shape but cannot express "a bespoke row has no price", so the union is
 * re-established HERE, at the boundary, by validating `kind` against the fields
 * that actually arrived.
 *
 * This is also the only place a branded id is minted. Because `RtwId` is
 * `string & { [brand]: "RtwId" }` and the brand symbol is not exported, no other
 * module can conjure one — an id must come through a parse that checked its
 * kind. That is what makes the branding meaningful rather than decorative.
 *
 * If a row arrives in an impossible shape (a gown carrying a price, say — which
 * the database CHECK should already prevent), parsing FAILS LOUDLY here rather
 * than producing a half-valid object that renders a "Buy" button on a
 * commission.
 */

const imageSchema = z.object({
  path: z.string(),
  alt: z.string(),
  position: z.number().int(),
});

const sizeSchema = z.object({
  label: z.string(),
  in_stock: z.boolean(),
  position: z.number().int(),
});

const facetLinkSchema = z.object({
  facet_values: z.object({
    facet_key: z.string(),
    value: z.string(),
    slug: z.string(),
  }),
});

const baseRow = {
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  lead_time_note: z.string().nullable().default(null),
  badge: z.string().nullable().default(null),
  product_images: z.array(imageSchema).default([]),
  product_facet_values: z.array(facetLinkSchema).default([]),
};

/** Shared shape-normalising for the fields every kind carries. */
function common(row: {
  slug: string;
  name: string;
  description: string | null;
  lead_time_note: string | null;
  badge: string | null;
  product_images: z.infer<typeof imageSchema>[];
  product_facet_values: z.infer<typeof facetLinkSchema>[];
}) {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    leadTimeNote: row.lead_time_note,
    badge: row.badge,
    images: [...row.product_images]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ path: i.path, alt: i.alt, position: i.position })),
    facets: row.product_facet_values.map((f) => ({
      facetKey: f.facet_values.facet_key,
      value: f.facet_values.value,
      slug: f.facet_values.slug,
    })),
  };
}

const sortSizes = (sizes: z.infer<typeof sizeSchema>[]) =>
  [...sizes]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ label: s.label, inStock: s.in_stock }));

// ── The three kinds ───────────────────────────────────────────────────────
// Note each branch asserts the ABSENCE of the other kind's pricing fields.
// A row that satisfies two branches is a data-integrity bug and must not parse.

const rtwSchema = z
  .object({
    ...baseRow,
    kind: z.literal("rtw"),
    price_cents: z.number().int().positive(),
    price_from_cents: z.null(),
    price_to_cents: z.null(),
    colour: z.string().nullable().default(null),
    product_sizes: z.array(sizeSchema).default([]),
  })
  .transform((row) => ({
    ...common(row),
    kind: "rtw" as const,
    id: row.id as RtwId,
    priceCents: row.price_cents,
    colour: row.colour,
    sizes: sortSizes(row.product_sizes),
  }));

const accessorySchema = z
  .object({
    ...baseRow,
    kind: z.literal("accessory"),
    price_cents: z.number().int().positive(),
    price_from_cents: z.null(),
    price_to_cents: z.null(),
    colour: z.string().nullable().default(null),
    product_sizes: z.array(sizeSchema).default([]),
  })
  .transform((row) => ({
    ...common(row),
    kind: "accessory" as const,
    id: row.id as AccessoryId,
    priceCents: row.price_cents,
    colour: row.colour,
    sizes: sortSizes(row.product_sizes),
  }));

const bespokeSchema = z
  .object({
    ...baseRow,
    kind: z.literal("bespoke"),
    // Explicitly null. If a price ever appears on a gown, fail here.
    price_cents: z.null(),
    price_from_cents: z.number().int().positive(),
    price_to_cents: z.number().int().positive(),
  })
  .transform((row) => ({
    ...common(row),
    kind: "bespoke" as const,
    id: row.id as BespokeId,
    priceFromCents: row.price_from_cents,
    priceToCents: row.price_to_cents,
  }));

export const productSchema = z.discriminatedUnion("kind", [
  rtwSchema,
  accessorySchema,
  bespokeSchema,
]);

/**
 * Mints a `CartableId` from an id whose kind has been PROVEN cart-eligible.
 *
 * Lives here because this module is the only place brands are minted — that is
 * what makes the branding meaningful rather than decorative (see the header
 * comment and lib/products/types.ts).
 *
 * The `kind` argument is not decorative either: it is the evidence. Callers
 * must pass the kind as read back from the database, never one they assumed.
 * `priceCart` is the intended caller — it filters `kind` in SQL, so a row it
 * returns has been checked by Postgres, not by the browser.
 *
 * Do NOT call this on a product id that arrived in a request body. An id from
 * the wire is a `RawCartLine["productId"]` — a plain string — until a query
 * proves otherwise.
 */
export function cartableIdFromRow(id: string, kind: "rtw" | "accessory"): CartableId {
  // The signature is the check: `kind` cannot be 'bespoke' here.
  void kind;
  return id as CartableId;
}

/**
 * Parse one row. Throws on an impossible shape — deliberately. A malformed
 * product is not something to render defensively around; it means the database
 * and the model disagree, and that must surface immediately.
 */
export function parseProduct(row: unknown): Product {
  return productSchema.parse(row) as Product;
}

/**
 * Parse a list, discarding rows that fail.
 *
 * A single corrupt row should not blank an entire listing page, so failures are
 * logged and skipped here rather than thrown. Detail pages use `parseProduct`
 * and do throw, because rendering the wrong thing for a specific product is
 * worse than showing an error.
 */
export function parseProducts(rows: unknown[]): Product[] {
  const out: Product[] = [];

  for (const row of rows) {
    const result = productSchema.safeParse(row);
    if (result.success) {
      out.push(result.data as Product);
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[products] dropped unparseable row:",
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      );
    }
  }

  return out;
}
