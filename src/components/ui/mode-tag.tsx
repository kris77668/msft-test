import { clsx } from "@/lib/clsx";
import type { ProductKind } from "@/lib/products/types";

/**
 * ModeTag — the visual signifier of which purchase path a product belongs to.
 * Ported from core.jsx's <ModeTag>.
 *
 * This appears everywhere a product does: feed, gallery, saved list, PDP. It is
 * the customer-facing half of the two-path model — the tag is how someone knows,
 * before they tap anything, whether this is a thing they can buy or a thing they
 * book an appointment about.
 *
 * Note it takes a ProductKind rather than a boolean, so adding a fourth kind
 * later is a compile error here rather than a silently wrong tag.
 */
export function ModeTag({
  kind,
  className,
}: {
  kind: ProductKind;
  className?: string;
}) {
  if (kind === "bespoke") {
    return (
      <span
        className={clsx(
          "eyebrow border-gold text-gold-text bg-gold-tint inline-block border px-3 py-1.5",
          className
        )}
      >
        Bespoke · By Appointment
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "eyebrow border-rule text-mocha inline-block border px-3 py-1.5",
        className
      )}
    >
      Ready to Wear
    </span>
  );
}
