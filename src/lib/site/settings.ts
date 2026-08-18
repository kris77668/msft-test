import { cache } from "react";
import { createStaticSupabase } from "@/lib/supabase/static";

/**
 * Studio details, from the single-row `site_settings` table.
 *
 * The prototype scattered the address through roughly fifteen body-copy strings
 * — "hand-finished in Double Bay", "17 years on Knox Street", the footer, the
 * contact page. The real address is unconfirmed, and the brief was explicit that
 * it should be flagged rather than hardcoded, so every surface reads from here.
 *
 * While `contentIsPlaceholder` is true the UI marks these values visibly, so
 * invented details cannot reach production unnoticed.
 */

export interface SiteSettings {
  /** The brand, used everywhere customer-facing. Not the registered entity. */
  studioName: string;
  /**
   * Registered entity name for tax invoices ("… Pty Ltd"), when it differs from
   * the trading name. Null falls back to `studioName`.
   */
  legalName: string | null;
  addressLine: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  /** The phrase used inline in prose, e.g. "Double Bay". */
  locality: string | null;
  phone: string | null;
  email: string | null;
  instagramUrl: string | null;
  openingHours: string | null;
  /** Required on tax invoices. */
  abn: string | null;
  contentIsPlaceholder: boolean;
}

const FALLBACK: SiteSettings = {
  studioName: "Ms Fairy Tale",
  legalName: null,
  addressLine: null,
  suburb: null,
  state: null,
  postcode: null,
  locality: null,
  phone: null,
  email: null,
  instagramUrl: null,
  openingHours: null,
  abn: null,
  contentIsPlaceholder: true,
};

/**
 * Row shape as returned by Supabase.
 *
 * Declared by hand because the client is untyped: generating `Database` types
 * needs `supabase gen types`, which requires CLI auth we don't have in this
 * environment. Replace these with generated types when that's available —
 * they're a stand-in, not a design choice.
 */
interface SiteSettingsRow {
  studio_name: string;
  legal_name: string | null;
  studio_address_line: string | null;
  studio_suburb: string | null;
  studio_state: string | null;
  studio_postcode: string | null;
  studio_locality: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  opening_hours: string | null;
  abn: string | null;
  content_is_placeholder: boolean;
}

/**
 * Studio details for the footer, contact page and tax invoices.
 *
 * Cookie-free client on purpose. The footer renders on every page, so reading
 * cookies here would opt the ENTIRE SITE out of static rendering — this single
 * call was making even the product pages server-render on demand. Nothing here
 * is user-specific.
 *
 * Wrapped in React `cache()` so a page that reads settings both directly and
 * through the `Footer` — the home, atelier, contact and legal pages all do —
 * makes one query per request instead of two. On the force-dynamic pages
 * (account, confirmation) that dedupe happens every request.
 */
export const getSiteSettings = cache(async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = createStaticSupabase();

  const { data, error } = await supabase
    .from("site_settings")
    .select(
      "studio_name, legal_name, studio_address_line, studio_suburb, studio_state, studio_postcode, studio_locality, phone, email, instagram_url, opening_hours, abn, content_is_placeholder"
    )
    .maybeSingle<SiteSettingsRow>();

  // Chrome renders on every page; a settings failure should degrade to a
  // nameless-but-working header, not a 500 across the entire site.
  if (error || !data) return FALLBACK;

  return {
    studioName: data.studio_name,
    legalName: data.legal_name,
    addressLine: data.studio_address_line,
    suburb: data.studio_suburb,
    state: data.studio_state,
    postcode: data.studio_postcode,
    locality: data.studio_locality,
    phone: data.phone,
    email: data.email,
    instagramUrl: data.instagram_url,
    openingHours: data.opening_hours,
    abn: data.abn,
    contentIsPlaceholder: data.content_is_placeholder,
  };
});

/** Single-line postal address, omitting parts that aren't confirmed yet. */
export function formatAddress(s: SiteSettings): string | null {
  const parts = [s.addressLine, s.suburb, [s.state, s.postcode].filter(Boolean).join(" ")]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));

  return parts.length ? parts.join(", ") : null;
}
