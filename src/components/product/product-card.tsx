import Link from "next/link";
import { Photo } from "@/components/ui/photo";
import { formatMoney, formatMoneyRange } from "@/lib/money";
import { isBespoke, type Product } from "@/lib/products/types";
import { clsx } from "@/lib/clsx";

/**
 * Product card — used in the shop grid, the bespoke gallery and the combined
 * gallery. One component, because the Ready-to-Wear / Bespoke distinction must
 * look identical everywhere a product appears. Two separate card components
 * would eventually drift.
 *
 * The branch below is the customer-facing half of the two-path model:
 *
 *   Ready to Wear → price shown plainly, links to a product page with a cart
 *   Bespoke       → "From $X" in gold, links to a gown page with a booking form
 *
 * Because `Product` is a discriminated union, `product.priceCents` simply does
 * not exist on the bespoke branch — a price tag on a commission is a type error,
 * not a code-review catch.
 */
export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1080px) 25vw, (min-width: 768px) 33vw, 50vw",
}: {
  product: Product;
  /** Set on the first row only — these are the LCP candidates. */
  priority?: boolean;
  sizes?: string;
}) {
  const bespoke = isBespoke(product);
  const href = bespoke ? `/bespoke/${product.slug}` : `/product/${product.slug}`;
  const cover = product.images[0];
  const hover = product.images[1];

  return (
    <Link href={href} className="group block focus-visible:outline-2 focus-visible:outline-offset-4">
      <div className="relative overflow-hidden">
        <Photo
          src={cover?.path ?? ""}
          alt={cover?.alt ?? product.name}
          ratio={3 / 4}
          sizes={sizes}
          priority={priority}
          imageClassName={clsx(
            "transition-transform duration-700",
            // Hover affordances key off pointer capability, not screen width:
            // a touch laptop at 1200px cannot hover, and the prototype gave it
            // a hover-only interaction anyway.
            hover ? "group-hover:opacity-0" : "group-hover:scale-105"
          )}
        />

        {/* Second image revealed on hover, where one exists. */}
        {hover && (
          <Photo
            src={hover.path}
            alt=""
            ratio={3 / 4}
            sizes={sizes}
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          />
        )}

        {product.badge && (
          <span className="bg-cream/90 eyebrow text-mocha absolute top-3 left-3 px-2.5 py-1.5">
            {product.badge}
          </span>
        )}

        {bespoke && (
          <span className="border-gold text-gold-text bg-cream/90 eyebrow absolute right-3 bottom-3 border px-2.5 py-1.5">
            Bespoke
          </span>
        )}
      </div>

      <div className="mt-3.5">
        <h3 className="font-display text-xl leading-tight font-light">{product.name}</h3>

        {bespoke ? (
          <p className="text-gold-text mt-1 text-sm">
            From {formatMoney(product.priceFromCents)}
          </p>
        ) : (
          <>
            {product.colour && (
              <p className="text-dusty-text mt-0.5 text-xs">{product.colour}</p>
            )}
            <p className="mt-1 text-sm">{formatMoney(product.priceCents)}</p>
          </>
        )}
      </div>
    </Link>
  );
}

/** Exported for the bespoke detail page's price line. */
export function BespokeInvestment({
  fromCents,
  toCents,
}: {
  fromCents: number;
  toCents: number;
}) {
  return (
    <p className="text-gold-text text-sm">
      Investment from{" "}
      <span className="font-display text-2xl">{formatMoneyRange(fromCents, toCents)}</span>
    </p>
  );
}
