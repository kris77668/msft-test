import Image from "next/image";
import { clsx } from "@/lib/clsx";

/**
 * Photo — the image primitive, ported from core.jsx's <Photo>.
 *
 * Keeps the prototype's blush gradient sitting underneath every image, so a slow
 * or failed load degrades to something that still looks like the brand rather
 * than a grey box. Everything else is delegated to next/image: responsive
 * srcset, lazy loading, AVIF/WebP.
 *
 * `alt` is REQUIRED. The prototype rendered alt="" on every image in the site,
 * which is both an SEO loss on a photography-led business and a WCAG failure.
 * For genuinely decorative imagery pass alt="" explicitly — that is a decision,
 * not an oversight.
 *
 * An EMPTY `src` renders the gradient alone. The schema permits a product with
 * no images (`product_images` defaults to `[]`), and callers guarding with
 * `src={cover?.path ?? ""}` looked safe but were not: next/image passes a blank
 * src straight through to <img src="">, which per the HTML spec resolves
 * against the document URL — so the browser re-downloads the current page as
 * an image, once per card, before firing onerror. On a 60-item grid that is 60
 * wasted full-page requests. Handled here rather than at each call site so a
 * new caller cannot reintroduce it.
 */

export interface PhotoProps {
  src: string;
  alt: string;
  /** Aspect ratio as a number (3/4) or "fill" to stretch to the parent. */
  ratio?: number | "fill";
  /** Responsive sizes hint. Get this right or the browser downloads too much. */
  sizes?: string;
  /** Set on the LCP image only — usually the hero. */
  priority?: boolean;
  /** 0–1 dark scrim, for text laid over imagery. */
  dim?: number;
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
}

/** Defined in globals.css so no colour literal lives in a component. */
const BLUSH_GRADIENT = "var(--gradient-blush)";

export function Photo({
  src,
  alt,
  ratio = 4 / 5,
  sizes = "(min-width: 1080px) 33vw, (min-width: 768px) 50vw, 100vw",
  priority = false,
  dim,
  className,
  imageClassName,
  children,
}: PhotoProps) {
  const isFill = ratio === "fill";
  const hasImage = src.trim().length > 0;

  // Uploaded images are absolute URLs on the R2 custom domain; local catalogue
  // assets are site-relative `/images/*` paths. The R2 images are already sized
  // and WebP-encoded at upload, so serving them `unoptimized` sends them
  // straight from Cloudflare's free egress instead of Netlify's metered image
  // CDN. Local assets still go through the optimiser (AVIF/WebP + srcset).
  const isRemote = /^https?:\/\//i.test(src.trim());

  return (
    <div
      className={clsx("relative overflow-hidden", isFill && "h-full", className)}
      style={{
        background: BLUSH_GRADIENT,
        ...(isFill ? {} : { aspectRatio: String(ratio) }),
      }}
      // Without a photograph the gradient is decoration, not content, so the
      // alt text is surfaced here instead — a product with no imagery is still
      // announced by name rather than skipped over.
      role={hasImage ? undefined : "img"}
      aria-label={hasImage || !alt ? undefined : alt}
    >
      {hasImage && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          quality={priority ? 90 : 75}
          unoptimized={isRemote}
          className={clsx("object-cover", imageClassName)}
        />
      )}

      {dim !== undefined && (
        <div
          className="absolute inset-0"
          style={{ background: "var(--color-scrim)", opacity: dim }}
          aria-hidden
        />
      )}

      {children}
    </div>
  );
}
