/**
 * Money.
 *
 * Every amount in this codebase is an INTEGER NUMBER OF CENTS. Never a float,
 * never a dollar figure. Floats lose money — 0.1 + 0.2 !== 0.3 — and mixing
 * units is how a $2,400 gown gets charged as $24.
 *
 * All stored prices are GST-INCLUSIVE. The business is GST-registered, and
 * Australian Consumer Law requires a single inclusive price to be displayed
 * prominently. The GST component is therefore extracted from the total
 * (total / 11), never added on top.
 */

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const AUD_WITH_CENTS = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format cents as AUD. Whole dollars render without decimals ("$2,400"),
 * matching the design; anything with cents keeps them ("$100.91").
 */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? AUD.format(dollars) : AUD_WITH_CENTS.format(dollars);
}

/**
 * "From $4,800 — $6,200". Bespoke only.
 *
 * Never render a bespoke gown with a single price: it implies a fixed,
 * purchasable amount, which is exactly the confusion the two-path model exists
 * to prevent.
 */
export function formatMoneyRange(fromCents: number, toCents: number): string {
  return `${formatMoney(fromCents)} — ${formatMoney(toCents)}`;
}

/**
 * The GST component of a GST-inclusive amount.
 *
 * At 10% GST, an inclusive total T contains T/11 of tax. Rounded to the nearest
 * cent, which is what the ATO expects on a tax invoice.
 */
export function gstComponent(inclusiveCents: number): number {
  return Math.round(inclusiveCents / 11);
}

/** The ex-GST portion, for tax invoice line display. */
export function exGstAmount(inclusiveCents: number): number {
  return inclusiveCents - gstComponent(inclusiveCents);
}

/**
 * Per-instalment amount for buy-now-pay-later messaging ("4 payments of $600").
 *
 * Uses ceil so the quoted instalment never understates what the customer pays;
 * the provider absorbs the rounding on the final payment. The prototype used
 * Math.round, which could quote four instalments summing to less than the total.
 */
export function instalmentAmount(totalCents: number, instalments = 4): number {
  return Math.ceil(totalCents / instalments);
}
