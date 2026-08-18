import "server-only";
import Stripe from "stripe";
import { getEnv } from "@/lib/env";

/**
 * Stripe server client.
 *
 * `server-only`: the secret key moves money. If a client component ever imports
 * this, even transitively, the build fails rather than shipping it to browsers.
 */

let cached: Stripe | undefined;

export function getStripe(): Stripe {
  if (cached) return cached;

  cached = new Stripe(getEnv().STRIPE_SECRET_KEY, {
    // Pinned deliberately. Stripe rolls the API forward and an unpinned client
    // can start receiving reshaped objects after a dashboard upgrade, breaking
    // payments with no code change on our side.
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
    appInfo: { name: "Ms Fairy Tale", url: "https://www.msfairytale.com.au" },
  });

  return cached;
}

/** Currency and country are fixed: an Australian business selling in AUD. */
export const CURRENCY = "aud";
export const COUNTRY = "AU";
