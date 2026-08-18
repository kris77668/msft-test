import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createStaticSupabase } from "@/lib/supabase/static";
import { parseProduct, parseProducts } from "./schema";
import type { Product, ProductKind } from "./types";

/**
 * Product reads.
 *
 * Uses the publishable key under RLS, so only `status = 'published'` rows come
 * back — enforced by the database, not by remembering to add a filter here.
 */

/** Every field the model needs, in one round trip. */
const SELECT = `
  id, kind, slug, name, description, lead_time_note, badge, colour,
  price_cents, price_from_cents, price_to_cents,
  product_images ( path, alt, position ),
  product_sizes ( label, in_stock, position ),
  product_facet_values ( facet_values ( facet_key, value, slug ) )
`;

export type ProductSort = "featured" | "new" | "price-asc" | "price-desc";

export interface ProductQuery {
  kinds?: readonly ProductKind[];
  /** facetKey -> selected value slugs. OR within a key, AND across keys. */
  facets?: Readonly<Record<string, readonly string[]>>;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

/**
 * Product listing, filtering and sorting — all of it in Postgres.
 *
 * This used to fetch, parse, then filter facets in JavaScript, because
 * PostgREST cannot express "has ALL of these facet groups" across a join table
 * in one request. That worked, but it meant the Flutter app carried its own
 * copy of the OR-within-a-key, AND-across-keys logic — exactly the kind of
 * quiet semantics two codebases eventually disagree about.
 *
 * `search_products` now holds that logic once and both clients call it. The
 * function returns rows shaped identically to the PostgREST embedding it
 * replaced, nested `facet_values` wrapper included, so `parseProducts` and the
 * Zod schema below are untouched.
 *
 * It is SECURITY INVOKER, and `scripts/verify-schema.mjs` plants a draft and
 * asserts it stays hidden. That test is not ceremony: nothing here filters on
 * `status`, so a DEFINER version would bypass RLS and publish every draft.
 */
export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const supabase = createStaticSupabase();
  const { kinds, facets, sort = "featured", limit = 60, offset = 0 } = query;

  const { data, error } = await supabase.rpc("search_products", {
    p_kinds: kinds?.length ? (kinds as string[]) : null,
    p_facets: facets ?? {},
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(`getProducts failed: ${error.message}`);

  return parseProducts((data as unknown[]) ?? []);
}

/**
 * A single product by slug.
 *
 * Uses the cookie-free client deliberately: product pages contain no
 * user-specific data, and reading cookies would opt the route out of static
 * rendering entirely — costing a server round trip on the pages that matter most
 * for search. RLS still applies, so only published rows are visible.
 *
 * Wrapped in React `cache()` so the two calls a product page makes — one in
 * `generateMetadata`, one in the page body — share a single database round trip
 * per request. Next dedupes `fetch` automatically but not a Supabase query, and
 * the string `slug` argument makes this cache actually hit (unlike the
 * object-argument `getProducts`, which cache() would key by identity).
 */
export const getProductBySlug = cache(async function getProductBySlug(
  slug: string
): Promise<Product | null> {
  const supabase = createStaticSupabase();

  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getProductBySlug failed: ${error.message}`);
  if (!data) return null;

  return parseProduct(data);
});

/**
 * Slugs for `generateStaticParams` and `sitemap.ts`.
 *
 * Uses the cookie-free client: these run at build time where there is no HTTP
 * request, and touching `cookies()` there is a hard error in Next 16.
 */
export async function getAllProductSlugs(
  kinds?: readonly ProductKind[]
): Promise<{ slug: string; kind: ProductKind }[]> {
  const supabase = createStaticSupabase();

  let q = supabase.from("products").select("slug, kind");
  if (kinds?.length) q = q.in("kind", kinds as string[]);

  const { data, error } = await q;
  if (error) throw new Error(`getAllProductSlugs failed: ${error.message}`);

  return (data ?? []) as { slug: string; kind: ProductKind }[];
}

export interface FacetGroup {
  key: string;
  label: string;
  position: number;
  values: { value: string; slug: string; count: number }[];
}

/**
 * Facet groups with live counts, restricted to the kinds being browsed.
 *
 * Counts are derived from the products actually returned, so a value with zero
 * matches never appears — the prototype rendered its filter lists from a
 * hand-maintained array that had drifted from the data, leaving four fabrics
 * listed that matched nothing and several products unreachable.
 *
 * CACHED. The groups for a set of kinds do not depend on the active filters or
 * sort, so this result is identical for every request to /shop or /bespoke —
 * pages that are otherwise dynamic for their listing query. Without caching it
 * re-ran a full-catalogue read (limit 500) on every filter or sort click. It is
 * cached under the `facets` tag and revalidated whenever a product is saved,
 * published or deleted (see `revalidateGown` in products/actions.ts); the 1-hour
 * `revalidate` is a backstop only, so a facet assignment changed directly in the
 * database still appears within the hour. Safe to cache: everything here uses
 * the cookie-free client, so no dynamic request data is read.
 */
const cachedFacetGroups = unstable_cache(
  async (kinds: readonly ProductKind[]): Promise<FacetGroup[]> => {
    const supabase = createStaticSupabase();

    const { data: facets, error } = await supabase
      .from("facets")
      .select("key, label, position, applies_to")
      .order("position");

    if (error) throw new Error(`getFacetGroups failed: ${error.message}`);

    const products = await getProducts({ kinds, limit: 500 });

    return (facets ?? [])
      .filter((f) => kinds.some((k) => (f.applies_to as string[]).includes(k)))
      .map((f) => {
        const counts = new Map<string, { value: string; slug: string; count: number }>();

        for (const product of products) {
          for (const assignment of product.facets) {
            if (assignment.facetKey !== f.key) continue;
            const existing = counts.get(assignment.slug);
            if (existing) existing.count += 1;
            else
              counts.set(assignment.slug, {
                value: assignment.value,
                slug: assignment.slug,
                count: 1,
              });
          }
        }

        return {
          key: f.key,
          label: f.label,
          position: f.position,
          values: [...counts.values()].sort((a, b) => a.value.localeCompare(b.value)),
        };
      })
      .filter((group) => group.values.length > 0);
  },
  ["facet-groups"],
  { tags: ["facets"], revalidate: 3600 }
);

export function getFacetGroups(kinds: readonly ProductKind[]): Promise<FacetGroup[]> {
  return cachedFacetGroups(kinds);
}
