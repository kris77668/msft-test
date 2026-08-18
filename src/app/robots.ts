import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.msfairytale.com.au";

/**
 * robots.txt.
 *
 * Transactional and personal routes are disallowed: they have no search value,
 * and confirmation pages carry order details behind a token that should not be
 * crawled or cached.
 *
 * Faceted URLs are NOT blocked here. Single-facet pages ("column evening
 * dresses") match real searches and should rank; multi-facet combinations carry
 * `noindex, follow` in their metadata instead, which lets crawlers pass through
 * to the products without indexing a combinatorial explosion of near-duplicates.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/cart",
          "/checkout",
          "/confirmation",
          "/consultation/confirmed",
          "/newsletter/confirm",
          "/account",
          "/admin",
          "/api/",
          "/kitchen-sink",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
