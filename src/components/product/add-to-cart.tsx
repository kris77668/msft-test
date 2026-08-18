"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/store";
import { clsx } from "@/lib/clsx";
import type { CartableProduct } from "@/lib/products/types";

/**
 * Size selection and add-to-cart.
 *
 * The prop type is `CartableProduct`, so this component cannot be rendered for a
 * bespoke gown — that is a compile error, not a review comment. It is the reason
 * no size selector or cart button can appear on a commission.
 *
 * Adding is gated on choosing a size (the prototype did this too, and it was one
 * of the few genuinely working pieces of logic in it). The confirmation resets
 * after 2.2s, matching the original.
 */
export function AddToCart({ product }: { product: CartableProduct }) {
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);

  const inStock = product.sizes.filter((s) => s.inStock);

  function handleAdd() {
    if (!size) return;
    add(product, size);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <div>
      <fieldset>
        <legend className="eyebrow text-dusty-text mb-3">Size</legend>
        <div className="flex flex-wrap gap-2">
          {product.sizes.map((option) => {
            const selected = size === option.label;

            return (
              <button
                key={option.label}
                type="button"
                disabled={!option.inStock}
                aria-pressed={selected}
                onClick={() => setSize(option.label)}
                className={clsx(
                  "min-h-11 min-w-14 border px-4 text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2",
                  selected
                    ? "border-mocha bg-mocha text-cream"
                    : "border-rule hover:border-mocha",
                  !option.inStock && "cursor-not-allowed line-through opacity-35"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Button
        variant="primary"
        fullWidth
        size="lg"
        className="mt-6"
        disabled={!size || inStock.length === 0}
        onClick={handleAdd}
      >
        {inStock.length === 0
          ? "Currently unavailable"
          : !size
            ? "Select a Size"
            : added
              ? "Added to Cart"
              : "Add to Cart"}
      </Button>

      {/* Announced to screen readers without stealing focus. */}
      <p role="status" aria-live="polite" className="sr-only">
        {added ? `${product.name}, size ${size}, added to your cart.` : ""}
      </p>
    </div>
  );
}
