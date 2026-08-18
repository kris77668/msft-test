import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import Link from "next/link";
import { clsx } from "@/lib/clsx";

/**
 * Button — the action primitive.
 *
 * The variants are not decorative. `primary` and `bespoke` are the visual
 * expression of the two purchase paths, and the difference is deliberate:
 *
 *   primary  solid mocha rectangle — "Add to Cart". A transaction.
 *   bespoke  gold-outlined, calendar glyph — "Book a Consultation". An invitation.
 *
 * A bespoke gown must never render `primary`, and no evening piece should render
 * `bespoke`. Corners stay square (radius 0) throughout — this is an editorial
 * atelier, not a rounded-card SaaS product.
 */

type Variant = "primary" | "bespoke" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-mocha text-cream border border-mocha hover:bg-ink hover:border-ink",
  bespoke: "bg-cream text-mocha border-[1.5px] border-gold hover:bg-gold-tint",
  secondary: "bg-transparent text-mocha border border-rule hover:border-mocha",
  ghost: "bg-transparent text-mocha border border-transparent hover:border-rule",
};

const SIZES: Record<Size, string> = {
  sm: "px-4 py-3 text-[11px]",
  md: "px-6 py-4",
  lg: "px-8 py-5",
};

const BASE =
  "eyebrow inline-flex items-center justify-center gap-2.5 rounded-none " +
  "transition-colors duration-200 cursor-pointer " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  // Visible keyboard focus. The prototype had none anywhere.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mocha";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

export type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
  };

/** Same treatment, rendered as a link. Navigation is not a button. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  href,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
