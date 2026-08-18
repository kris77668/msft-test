import { StarIcon } from "./icons";
import { clsx } from "@/lib/clsx";

/**
 * Stars — a rating display, ported from core.jsx's <Stars>.
 *
 * Display only; there is no rating input anywhere in the product.
 *
 * Gold on a light background measures 2.58:1, which fails WCAG AA — but these
 * glyphs are decorative, and the accessible name carries the actual rating for
 * anyone not reading the shapes. The prototype rendered five bare spans with no
 * text alternative at all, so a screen reader announced nothing.
 */
export function Stars({
  rating,
  size = 13,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span
      className={clsx("text-gold inline-flex gap-0.5", className)}
      role="img"
      aria-label={`${filled} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} size={size} className={i < filled ? "opacity-100" : "opacity-25"} />
      ))}
    </span>
  );
}
