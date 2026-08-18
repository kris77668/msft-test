/**
 * Facet configuration and URL parsing.
 *
 * The prototype derived the product field from the filter's display label
 * (`p[category.toLowerCase()]`), which worked only by the accident that
 * "Silhouette" lowercases to "silhouette". Renaming a label or adding
 * "Colour Family" would have silently broken filtering with no type error.
 *
 * Here the key is explicit and separate from the label.
 */

export const FACET_KEYS = ["silhouette", "fabric", "neckline", "occasion"] as const;

export type FacetKey = (typeof FACET_KEYS)[number];

function isFacetKey(value: string): value is FacetKey {
  return (FACET_KEYS as readonly string[]).includes(value);
}

/**
 * Reads `?silhouette=column,mermaid&fabric=velvet` into a filter map.
 *
 * Unknown keys and empty values are dropped rather than erroring: a stale
 * bookmark or a hand-edited URL should degrade to showing more products, never
 * to a 500. Values are not validated against the database here — a slug that
 * matches nothing simply matches nothing.
 */
export function parseFacetParams(
  searchParams: Record<string, string | string[] | undefined>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const [key, raw] of Object.entries(searchParams)) {
    if (!isFacetKey(key) || raw === undefined) continue;

    const value = Array.isArray(raw) ? raw.join(",") : raw;
    const slugs = value
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (slugs.length) out[key] = slugs;
  }

  return out;
}

/**
 * Merges changes into an existing query string, preserving everything else.
 *
 * Shared by the filter panel (client, from `useSearchParams`) and the shop
 * page's sort links (server, from `searchParams`). They previously disagreed:
 * the panel carefully carried the whole query string through, while the sort
 * links hardcoded `?sort=…` and silently dropped every active facet — so
 * choosing a sort order cleared the customer's filters.
 *
 * Passing `null` for a value removes that key.
 */
export function mergeQuery(
  current: URLSearchParams,
  changes: Record<string, string | null>
): string {
  const next = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }

  return next.toString();
}

/**
 * Next's `searchParams` as a `URLSearchParams`, so server components can use
 * `mergeQuery` on the same footing as client components.
 *
 * A repeated key arrives as an array; joining with a comma matches how
 * `parseFacetParams` above reads multi-value facets.
 */
export function toSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): URLSearchParams {
  const out = new URLSearchParams();

  for (const [key, raw] of Object.entries(searchParams)) {
    if (raw === undefined) continue;
    out.set(key, Array.isArray(raw) ? raw.join(",") : raw);
  }

  return out;
}

/**
 * True when more than one facet is active.
 *
 * Faceted navigation generates combinatorial URLs and is a classic crawl-budget
 * sink, so anything beyond a single facet is marked `noindex, follow` with a
 * canonical pointing at the unfiltered listing. Single-facet pages
 * ("column evening dresses") stay indexable because they match real searches.
 */
export function shouldNoIndex(facets: Record<string, string[]>): boolean {
  const activeKeys = Object.keys(facets).length;
  const totalValues = Object.values(facets).reduce((n, v) => n + v.length, 0);
  return activeKeys > 1 || totalValues > 1;
}
