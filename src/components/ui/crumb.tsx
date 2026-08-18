import Link from "next/link";
import { clsx } from "@/lib/clsx";

/**
 * Breadcrumbs — ported from core.jsx's <Crumb>.
 *
 * Rendered as a real <nav><ol> rather than the prototype's divs, so assistive
 * tech announces it as navigation and the current page is marked with
 * aria-current. Track D emits matching BreadcrumbList JSON-LD from the same data.
 *
 * Uses `dusty-text` rather than `dusty`: at 11px this is small text, and plain
 * dusty measures 2.79:1 on cream.
 */

export interface CrumbItem {
  label: string;
  /** Omit for the current page. */
  href?: string;
}

export function Crumb({
  items,
  className,
}: {
  items: readonly CrumbItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="text-dusty-text flex flex-wrap items-center gap-2">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;

          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link href={item.href} className="eyebrow hover:text-mocha transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className={clsx("eyebrow", isLast && "text-mocha")} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}

              {!isLast && (
                <span aria-hidden className="opacity-50">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
