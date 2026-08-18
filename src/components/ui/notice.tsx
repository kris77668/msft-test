import { clsx } from "@/lib/clsx";

/**
 * Inline notice — the one packaged alternative to a per-field error.
 *
 * There were three ad-hoc versions of this before: two bare
 * `<p role="alert" className="text-error text-sm">` in the checkout page and
 * the richer left-ruled treatment in the cart. `role="alert"` in particular was
 * being copy-pasted, and getting it wrong is silent — a screen reader simply
 * never announces the failure.
 *
 * COLOUR CONSTRAINT: `error` is #bd4d46, which measures 4.52:1 on cream and
 * about 4.3:1 on paper. It therefore passes AA on the page background and FAILS
 * on `bg-paper`. `check-contrast.mjs` never iterates paper, so nothing would
 * catch that automatically — hence no paper-backed variant here.
 */

type Tone = "error" | "quiet";
/** `xs` is the storefront default; `sm` matches the admin/booking error scale. */
type Size = "xs" | "sm";

const TONES: Record<Tone, string> = {
  error: "border-error text-error",
  quiet: "border-rule text-dusty-text",
};

const SIZES: Record<Size, string> = {
  xs: "text-xs",
  sm: "text-sm",
};

export function Notice({
  tone = "error",
  size = "xs",
  children,
  className,
}: {
  tone?: Tone;
  size?: Size;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      // Only genuine errors interrupt a screen reader. A quiet notice is
      // informational and announced politely when the user gets to it.
      role={tone === "error" ? "alert" : "status"}
      className={clsx("border-l-2 py-1 pl-3", SIZES[size], TONES[tone], className)}
    >
      {children}
    </p>
  );
}
