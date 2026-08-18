import type { Appearance } from "@stripe/stripe-js";

/**
 * The atelier theme for Stripe Elements.
 *
 * These are literal hex values, which is the ONE sanctioned exception to the
 * "no colour outside globals.css" rule (see README): Elements render in a
 * cross-origin iframe and the Appearance API cannot read our CSS custom
 * properties. Keep this list in sync with `globals.css` by hand.
 *
 * It lived inline in both `checkout/page.tsx` and `consultation/booking-wizard.tsx`
 * and the two copies had already drifted — the checkout carried `spacingUnit`
 * and the booking wizard did not. This is the checkout version, now shared, so
 * the card fields look identical in both flows.
 *
 * Client-safe: a plain constant with no server imports, so it may be pulled into
 * the "use client" checkout and booking components.
 */
export const STRIPE_APPEARANCE: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#3d2e26",
    colorBackground: "#faf6ef",
    colorText: "#3d2e26",
    colorDanger: "#bd4d46",
    fontFamily: "Jost, system-ui, sans-serif",
    borderRadius: "0px",
    spacingUnit: "4px",
  },
};
