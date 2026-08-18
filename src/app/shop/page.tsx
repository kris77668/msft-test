import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Newsletter } from "@/components/chrome/newsletter";
import { Crumb } from "@/components/ui/crumb";
import { ProductCard } from "@/components/product/product-card";
import { FilterPanel } from "@/components/product/filter-panel";
import { SortSheet } from "@/components/product/sort-sheet";
import { ButtonLink } from "@/components/ui/button";
import { getFacetGroups, getProducts, type ProductSort } from "@/lib/products/queries";
import {
  parseFacetParams,
  shouldNoIndex,
  mergeQuery,
  toSearchParams,
} from "@/lib/products/facets";

/**
 * Faceted URLs are a classic crawl-budget sink: n facets with m values produce
 * a combinatorial explosion of near-duplicate pages.
 *
 * Policy — a SINGLE active facet stays indexable, because "column evening
 * dresses" is a real search someone makes. Anything beyond that gets
 * `noindex, follow`, so crawlers still reach the products through it without
 * indexing thousands of permutations, with a canonical pointing at the listing.
 */
export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const facets = parseFacetParams(await props.searchParams);
  const noIndex = shouldNoIndex(facets);

  return {
    title: "Evening Wear",
    description:
      "Made-to-order evening gowns and accessories, hand-finished in Sydney. Ships in 8–10 weeks, with Afterpay and Zip available.",
    alternates: { canonical: "/shop" },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * Evening wear listing.
 *
 * Dynamic because it reads `searchParams` for filters. `searchParams` is a
 * Promise in Next 16 — synchronous access was removed.
 *
 * Only `rtw` and `accessory` kinds appear here. The prototype filtered the
 * EVENING array while looking products up in SHOP_ITEMS, so its two accessories
 * were reachable by URL but appeared in no listing at all.
 */
export default async function ShopPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const facets = parseFacetParams(searchParams);
  const sort = parseSort(searchParams.sort);

  const [products, groups] = await Promise.all([
    getProducts({ kinds: ["rtw", "accessory"], facets, sort }),
    getFacetGroups(["rtw", "accessory"]),
  ]);

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Evening Wear" }]} />

        <header className="mt-6 max-w-2xl">
          <h1 className="font-display text-4xl font-light md:text-5xl">
            Evening <em className="italic">wear</em>
          </h1>
          <p className="mt-3 text-sm opacity-80">
            Made to order and hand-finished in the atelier. Afterpay and Zip
            available at checkout.
          </p>
        </header>

        <div className="mt-10 grid gap-10 md:grid-cols-[210px_1fr] md:gap-12">
          <Suspense fallback={<div className="text-dusty-text text-xs">Loading filters…</div>}>
            <FilterPanel groups={groups} resultCount={products.length} />
          </Suspense>

          <div>
            <div className="mb-6 hidden items-center justify-between md:flex">
              <p className="text-dusty-text text-xs">{products.length} pieces</p>
              <Suspense fallback={null}>
                <SortLinks current={sort} searchParams={searchParams} />
              </Suspense>
            </div>

            {/* The mobile equivalent. Sits beside the filter trigger rather
                than unhiding the desktop links, whose 19px tap targets fail
                the 44px floor check-mobile.mjs enforces. */}
            <div className="mb-6 flex items-center justify-between md:hidden">
              <p className="text-dusty-text text-xs">{products.length} pieces</p>
              <Suspense fallback={null}>
                <SortSheet
                  current={sort}
                  options={SORTS.map((option) => {
                    const query = mergeQuery(toSearchParams(searchParams), {
                      sort: option.value === "featured" ? null : option.value,
                    });
                    return {
                      value: option.value,
                      label: option.label,
                      href: query ? `?${query}` : "/shop",
                    };
                  })}
                />
              </Suspense>
            </div>

            {products.length === 0 ? (
              <div className="border-rule border px-6 py-16 text-center">
                <p className="font-display text-2xl font-light">Nothing matches those filters</p>
                <p className="mt-2 text-sm opacity-75">Try removing one to see more.</p>
                <ButtonLink href="/shop" variant="secondary" className="mt-6">
                  Clear filters
                </ButtonLink>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
                {products.map((product, i) => (
                  <li key={product.slug}>
                    <ProductCard product={product} priority={i < 3} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <Newsletter variant="band" source="shop" />
      <Footer />
    </>
  );
}

const SORTS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "new", label: "New in" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
];

/**
 * Links rather than a <select>, so sorting works without JavaScript.
 *
 * Each href carries the CURRENT query string forward with only `sort` changed.
 * These used to be bare `?sort=…`, which silently discarded every active facet:
 * filtering to velvet mermaids and then sorting by price dropped you back into
 * the unfiltered catalogue with the checkboxes cleared. `mergeQuery` is the same
 * helper the filter panel uses, so the two directions can no longer disagree.
 *
 * Desktop-only, as before — the wrapper above is `hidden md:flex`. These are
 * 11px eyebrow links with no padding, so exposing them at mobile widths would
 * put ~19px tap targets on a route that check-mobile.mjs enforces a 44px floor
 * on. The mobile equivalent is SortSheet, rendered beside this as a bottom sheet with
 * 52px targets — see components/product/sort-sheet.tsx.
 */
function SortLinks({
  current,
  searchParams,
}: {
  current: ProductSort;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = toSearchParams(searchParams);

  return (
    <div className="flex items-center gap-4">
      {SORTS.map((option) => {
        // "featured" is the default, so it needs no parameter — this keeps the
        // canonical listing URL clean rather than ?sort=featured.
        const query = mergeQuery(params, {
          sort: option.value === "featured" ? null : option.value,
        });

        return (
          <a
            key={option.value}
            href={query ? `?${query}` : "/shop"}
            aria-current={current === option.value ? "true" : undefined}
            className={`eyebrow ${current === option.value ? "text-mocha underline" : "text-dusty-text"}`}
          >
            {option.label}
          </a>
        );
      })}
    </div>
  );
}

function parseSort(value: string | string[] | undefined): ProductSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  const allowed: ProductSort[] = ["featured", "new", "price-asc", "price-desc"];
  return allowed.includes(candidate as ProductSort) ? (candidate as ProductSort) : "featured";
}
