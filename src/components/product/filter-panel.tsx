"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { CloseIcon } from "@/components/ui/icons";
import { mergeQuery, FACET_KEYS } from "@/lib/products/facets";
import type { FacetGroup } from "@/lib/products/queries";

/**
 * Faceted filter UI.
 *
 * State lives in the URL, not in React. `/shop?silhouette=column,mermaid` is
 * shareable, back-button-friendly, and server-rendered — the prototype kept
 * filters in component state, so a filtered view could not be linked or indexed.
 *
 * Multi-select within a facet is OR; across facets it is AND. Counts come from
 * the database, and values matching nothing are never rendered — the prototype's
 * filter lists were hand-maintained and had drifted, offering four fabrics that
 * matched no product while leaving several products unreachable.
 *
 * One panel serves desktop and mobile: rendered twice with CSS visibility rather
 * than branching on a JS width, which would cause a hydration mismatch.
 */
export function FilterPanel({
  groups,
  resultCount,
}: {
  groups: readonly FacetGroup[];
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);

  const activeCount = useActiveCount(groups);

  return (
    <>
      {/* Mobile trigger */}
      <div className="flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="eyebrow border-rule border px-4 py-3"
          aria-expanded={open}
        >
          Filter{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <span className="text-dusty-text text-xs">{resultCount} pieces</span>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block" aria-label="Filters">
        <FilterGroups groups={groups} />
      </aside>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button
            type="button"
            className="bg-scrim/50 absolute inset-0"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          />
          <div className="bg-cream absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="eyebrow">Filter</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close filters">
                <CloseIcon size={20} />
              </button>
            </div>

            <FilterGroups groups={groups} />

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="eyebrow bg-mocha text-cream mt-6 w-full px-6 py-4"
            >
              Show {resultCount} pieces
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function useActiveCount(groups: readonly FacetGroup[]): number {
  const params = useSearchParams();
  return groups.reduce(
    (sum, g) => sum + (params.get(g.key)?.split(",").filter(Boolean).length ?? 0),
    0
  );
}

function FilterGroups({ groups }: { groups: readonly FacetGroup[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const selected = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];

  const toggle = (key: string, slug: string) => {
    const current = selected(key);
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];

    const query = mergeQuery(params, {
      [key]: next.length ? next.join(",") : null,
      page: null, // a filter change invalidates the current page number
    });

    // `scroll: false` keeps the viewport where it is — re-filtering should not
    // throw the customer back to the top of the page.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  /**
   * Clears the facets — and only the facets.
   *
   * This used to navigate to the bare pathname, which also discarded an active
   * `sort`. "Clear all" under a list of filter checkboxes means clear the
   * filters; silently resetting the sort order too is a change the customer
   * didn't ask for.
   */
  const clearAll = () => {
    const cleared = Object.fromEntries(FACET_KEYS.map((key) => [key, null]));
    const query = mergeQuery(params, { ...cleared, page: null });

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const anyActive = groups.some((g) => selected(g.key).length > 0);

  return (
    <div className="flex flex-col gap-7">
      {anyActive && (
        <button type="button" onClick={clearAll} className="eyebrow text-dusty-text self-start underline">
          Clear all
        </button>
      )}

      {groups.map((group) => (
        <fieldset key={group.key}>
          <legend className="eyebrow text-dusty-text mb-3">{group.label}</legend>

          <div className="flex flex-col gap-2.5">
            {group.values.map((value) => {
              const isOn = selected(group.key).includes(value.slug);

              return (
                <label
                  key={value.slug}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(group.key, value.slug)}
                    className="border-rule accent-mocha h-4 w-4 rounded-none border"
                  />
                  <span className={clsx(isOn && "font-normal")}>{value.value}</span>
                  <span className="text-dusty-text text-xs">({value.count})</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
