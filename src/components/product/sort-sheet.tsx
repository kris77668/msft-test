"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductSort } from "@/lib/products/queries";

/**
 * Mobile sort.
 *
 * The desktop control is a row of 11px eyebrow links with no padding — roughly
 * 19px tall, well under the 44px floor `check-mobile.mjs` enforces — so it is
 * `hidden md:flex` and phone users had no way to sort at all. Given most
 * traffic arrives from Instagram on a phone, "cannot sort by price" was the
 * larger of the two problems.
 *
 * Built as a sheet mirroring `filter-panel.tsx` rather than by unhiding the
 * links, which is what that file's own comment asked for.
 *
 * Options are anchors, not buttons: sort belongs in the URL so it survives a
 * back button and can be shared, and the server component re-renders from the
 * query string. `mergeQuery` on the caller's side keeps active facets intact —
 * the desktop links once dropped them, and a second implementation here would
 * be a second chance to reintroduce that.
 */
export function SortSheet({
  current,
  options,
}: {
  current: ProductSort;
  options: readonly { value: ProductSort; label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const currentLabel = options.find((o) => o.value === current)?.label ?? "Featured";

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="eyebrow border-rule border px-4 py-3"
      >
        Sort: {currentLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Sort">
          <button
            type="button"
            aria-label="Close sort"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />

          <div className="bg-cream absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto p-5">
            <p className="eyebrow text-dusty-text">Sort by</p>

            <ul className="mt-4 flex flex-col">
              {options.map((option) => (
                <li key={option.value}>
                  <a
                    href={option.href}
                    aria-current={current === option.value ? "true" : undefined}
                    onClick={(e) => {
                      // Client-side so the sheet can close without a full
                      // reload; the href stays real so it works without JS and
                      // can be opened in a new tab.
                      e.preventDefault();
                      setOpen(false);
                      router.push(option.href, { scroll: false });
                    }}
                    className={`border-softrule flex min-h-[52px] items-center border-b text-sm ${
                      current === option.value ? "text-mocha" : "text-dusty-text"
                    }`}
                  >
                    {option.label}
                    {current === option.value && <span className="ml-2">·</span>}
                  </a>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="eyebrow bg-mocha text-cream mt-6 min-h-[52px] w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
