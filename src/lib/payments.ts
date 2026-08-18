/**
 * Payment method configuration.
 *
 * Enabled methods live in the Stripe dashboard, not here — Stripe's Payment
 * Element renders whatever the account supports for the currency and the
 * customer's device. This module only holds what Stripe cannot tell the UI:
 * which buy-now-pay-later messaging is legitimate to *show* on a given price.
 */

export type BnplProvider = "afterpay" | "zip";

interface BnplConfig {
  readonly id: BnplProvider;
  readonly label: string;
  readonly instalments: number;
  /** Inclusive bounds, in cents. Outside these, do not render the messaging. */
  readonly minCents: number;
  readonly maxCents: number;
}

/**
 * Order-value limits.
 *
 * Stripe's merchant-side ceiling for Afterpay in Australia is A$4,000, which
 * covers the full evening-wear range. But individual Afterpay customers carry
 * their OWN spend caps — commonly around A$2,000, lower for new accounts — so a
 * meaningful share of customers will be declined on a $3,000 gown.
 *
 * The prototype rendered "or 4 payments of $850" on a $3,400 piece
 * unconditionally, promising a checkout path that would then fail. These bounds
 * gate the messaging so we never advertise something the customer cannot use.
 *
 * Adjust maxCents to match the real merchant agreement.
 */
export const BNPL: Record<BnplProvider, BnplConfig> = {
  afterpay: {
    id: "afterpay",
    label: "Afterpay",
    instalments: 4,
    minCents: 100,
    maxCents: 400_000,
  },
  zip: {
    id: "zip",
    label: "Zip",
    instalments: 4,
    minCents: 100,
    maxCents: 400_000,
  },
};

/** Which providers to advertise. Both are enabled on the Stripe account. */
export const ACTIVE_BNPL: readonly BnplProvider[] = ["afterpay", "zip"];

export function bnplEligible(totalCents: number, provider: BnplProvider): boolean {
  const cfg = BNPL[provider];
  return totalCents >= cfg.minCents && totalCents <= cfg.maxCents;
}

/** Providers that may legitimately be advertised at this price. */
export function eligibleBnpl(totalCents: number): readonly BnplConfig[] {
  return ACTIVE_BNPL.filter((p) => bnplEligible(totalCents, p)).map((p) => BNPL[p]);
}

/**
 * Wallets are surfaced automatically by Stripe's Express Checkout Element based
 * on the customer's device — Apple Pay on Safari/iOS, Google Pay on
 * Chrome/Android, Link where the customer has an account. Both are enabled on
 * the account.
 *
 * Apple Pay additionally requires domain verification: Stripe must serve a file
 * from /.well-known/apple-developer-merchantid-domain-association on the live
 * domain. Google Pay requires nothing. This must be done at deploy time or the
 * Apple Pay button silently never appears.
 */
export const WALLETS_ENABLED = true;
