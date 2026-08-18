/**
 * Australian Business Number validation and formatting.
 *
 * WHY THIS EXISTS RATHER THAN A TRUTHINESS CHECK.
 *
 * `site_settings.abn` shipped seeded with the literal string
 * 'ABN TO BE CONFIRMED', which is perfectly truthy — so `settings.abn && …`
 * would print that onto a document headed "Tax invoice". A tax invoice is a
 * statutory document; an invented, placeholder or mistyped ABN on one is worse
 * than issuing no invoice at all.
 *
 * So the invoice is gated on the ABN being STRUCTURALLY VALID, not on it being
 * non-empty, and not on the site-wide `content_is_placeholder` flag. That flag
 * is a single boolean covering the address, phone, ABN and everything else, and
 * the studio's details are confirmed piecemeal: the ABN is known while the
 * address is not. Gating the invoice on the global flag would mean either no
 * invoice until every field is confirmed, or flipping the flag and publishing a
 * placeholder address into the footer and the LocalBusiness structured data —
 * which is far harder to correct once Google has indexed it than to avoid.
 *
 * Pure, so it is unit-tested.
 */

/** ATO weighting for the modulus-89 checksum, most significant digit first. */
const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19] as const;

/**
 * True when `value` is a well-formed ABN.
 *
 * Runs the ATO's published check: strip separators, subtract 1 from the first
 * digit, apply the weights, and the weighted sum must divide by 89. That
 * catches every placeholder string and the overwhelming majority of typos and
 * transpositions — it does NOT prove the ABN is registered, active, or the
 * studio's. Only the ABN Lookup register can tell you that.
 */
export function isValidAbn(value: string | null | undefined): value is string {
  if (!value) return false;

  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{11}$/.test(digits)) return false;

  // Driven from WEIGHTS so the index is always in bounds by construction —
  // the regex above has already fixed `digits` at exactly 11 characters.
  const sum = WEIGHTS.reduce((total, weight, i) => {
    const digit = Number(digits[i]);
    // The leading digit is decremented before weighting. This is the step that
    // makes an all-zero or sequential string fail.
    return total + (i === 0 ? digit - 1 : digit) * weight;
  }, 0);

  return sum % 89 === 0;
}

/**
 * "52 613 500 404" — the ATO's canonical 2-3-3-3 grouping.
 *
 * Returns null for anything that does not validate, so a caller cannot format
 * its way past the check above.
 */
export function formatAbn(value: string | null | undefined): string | null {
  if (!isValidAbn(value)) return null;

  const d = value.replace(/[\s-]/g, "");
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}
