import type { MetadataRoute } from "next";
import { getAllProductSlugs } from "@/lib/products/queries";
import { getJournalPosts } from "@/lib/journal/queries";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.msfairytale.com.au";

/**
 * Sitemap.
 *
 * Only pages worth indexing. Deliberately excluded: cart, checkout, order and
 * booking confirmations, account, and the legal placeholders (which carry
 * `noindex` until a lawyer has written them).
 *
 * Priorities reflect commercial value for bridal search: gown and product pages
 * first, then their listings, then editorial — Real Weddings is the organic
 * acquisition route for bridal, so it outranks the brand pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts] = await Promise.all([
    getAllProductSlugs(),
    getJournalPosts(200),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1.0, lastModified: now },
    { url: `${BASE}/bespoke`, changeFrequency: "weekly", priority: 0.9, lastModified: now },
    { url: `${BASE}/shop`, changeFrequency: "weekly", priority: 0.9, lastModified: now },
    { url: `${BASE}/consultation`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
    { url: `${BASE}/journal`, changeFrequency: "weekly", priority: 0.7, lastModified: now },
    { url: `${BASE}/gallery`, changeFrequency: "weekly", priority: 0.6, lastModified: now },
    { url: `${BASE}/atelier`, changeFrequency: "monthly", priority: 0.6, lastModified: now },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.6, lastModified: now },
    { url: `${BASE}/faq`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${BASE}/quiz`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${BASE}/testimonials`, changeFrequency: "monthly", priority: 0.4, lastModified: now },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map(({ slug, kind }) => ({
    url: `${BASE}/${kind === "bespoke" ? "bespoke" : "product"}/${slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
    lastModified: now,
  }));

  const journalRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE}/journal/${post.slug}`,
    changeFrequency: "yearly",
    priority: 0.6,
    lastModified: new Date(post.publishedAt),
  }));

  return [...staticRoutes, ...productRoutes, ...journalRoutes];
}
