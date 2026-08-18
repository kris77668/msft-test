import type { Product } from "@/lib/products/types";
import type { SiteSettings } from "@/lib/site/settings";
import type { JournalPost } from "@/lib/journal/queries";

/**
 * schema.org structured data.
 *
 * THE CRITICAL RULE: `Product` with an `Offer` is emitted for ready-to-wear
 * ONLY. An Offer asserts a price at which the item can be bought right now — on
 * a bespoke commission that is false, and it can surface a "buy" affordance in
 * Google Shopping for something that takes eight to twelve months and starts
 * with a consultation. Bespoke gowns are marked up as a `Service` with a
 * `priceRange` instead, which is what they actually are.
 *
 * Same principle applies to reviews: `AggregateRating` is only emitted for
 * genuinely consented testimonials. Marking up invented reviews compounds a
 * content problem into a search penalty.
 */

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.msfairytale.com.au";

type Json = Record<string, unknown>;

export function organisationSchema(settings: SiteSettings): Json {
  const sameAs = [settings.instagramUrl].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "ClothingStore"],
    "@id": `${BASE}/#organization`,
    name: settings.studioName,
    url: BASE,
    description:
      "Haute couture bridal and evening wear atelier in Sydney. Bespoke wedding gowns made to measure, and ready-to-wear evening pieces.",
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    // Address is emitted only once confirmed — publishing a placeholder address
    // as LocalBusiness data would put a wrong location into Google's index,
    // which is far harder to correct than to avoid.
    ...(settings.contentIsPlaceholder
      ? {}
      : {
          address: {
            "@type": "PostalAddress",
            // Each part is omitted when absent rather than emitted as null.
            // The studio has a suburb-level address and no street line; a
            // `streetAddress: null` in LocalBusiness markup is invalid data
            // going into a search index, which is exactly the kind of thing
            // that is far harder to correct later than to avoid now.
            ...(settings.addressLine ? { streetAddress: settings.addressLine } : {}),
            ...(settings.suburb ? { addressLocality: settings.suburb } : {}),
            ...(settings.state ? { addressRegion: settings.state } : {}),
            ...(settings.postcode ? { postalCode: settings.postcode } : {}),
            addressCountry: "AU",
          },
          areaServed: { "@type": "City", name: "Sydney" },
        }),
    ...(settings.openingHours ? { openingHours: settings.openingHours } : {}),
    currenciesAccepted: "AUD",
    paymentAccepted: "Credit Card, Afterpay, Zip, Apple Pay, Google Pay",
  };
}

/** Ready-to-wear only. Never call this with a bespoke gown. */
export function productSchema(product: Extract<Product, { kind: "rtw" | "accessory" }>): Json {
  const image = product.images[0];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? `${product.name} by Ms Fairy Tale.`,
    ...(image ? { image: `${BASE}${image.path}` } : {}),
    ...(product.colour ? { color: product.colour } : {}),
    brand: { "@type": "Brand", name: "Ms Fairy Tale" },
    offers: {
      "@type": "Offer",
      url: `${BASE}/product/${product.slug}`,
      priceCurrency: "AUD",
      // schema.org expects a decimal string; our prices are integer cents.
      price: (product.priceCents / 100).toFixed(2),
      availability: product.sizes.some((s) => s.inStock)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@id": `${BASE}/#organization` },
    },
  };
}

/**
 * Bespoke gowns: a Service, not a Product with an Offer.
 *
 * `priceRange` communicates the investment band without asserting a purchasable
 * price, which keeps the markup honest and keeps the gown out of shopping feeds.
 */
export function bespokeGownSchema(gown: Extract<Product, { kind: "bespoke" }>): Json {
  const image = gown.images[0];

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Bespoke wedding gown commission",
    name: gown.name,
    ...(image ? { image: `${BASE}${image.path}` } : {}),
    provider: { "@id": `${BASE}/#organization` },
    areaServed: { "@type": "City", name: "Sydney" },
    url: `${BASE}/bespoke/${gown.slug}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "AUD",
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: (gown.priceFromCents / 100).toFixed(2),
        maxPrice: (gown.priceToCents / 100).toFixed(2),
        priceCurrency: "AUD",
        valueAddedTaxIncluded: true,
      },
      availability: "https://schema.org/LimitedAvailability",
    },
  };
}

export function articleSchema(post: JournalPost): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    ...(post.coverPath ? { image: `${BASE}${post.coverPath}` } : {}),
    author: { "@id": `${BASE}/#organization` },
    publisher: { "@id": `${BASE}/#organization` },
    mainEntityOfPage: `${BASE}/journal/${post.slug}`,
  };
}

export function breadcrumbSchema(items: readonly { label: string; href?: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${BASE}${item.href}` } : {}),
    })),
  };
}

export function faqSchema(faqs: readonly { question: string; answer: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
