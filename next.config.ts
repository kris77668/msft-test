import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * `Referrer-Policy` is the load-bearing one. The order and booking confirmation
 * pages carry a `?t=<confirmation_token>` — a credential that unlocks a
 * customer's order details. Under the default referrer behaviour the full URL,
 * token included, is sent in the `Referer` header to any third-party host the
 * page contacts. `strict-origin-when-cross-origin` sends only the origin
 * off-site, so the token stays put.
 *
 * ON CSP — why `script-src` is absent, deliberately:
 *
 * This app has two sources of inline script it cannot remove: the JSON-LD
 * blocks (components/seo/json-ld.tsx, on nearly every page) and Next's own
 * flight-payload bootstrap. Allowing them needs either a nonce or
 * `'unsafe-inline'`.
 *
 *   - A nonce must be minted per request from middleware, which forces every
 *     route to render dynamically. That would discard the `revalidate` ISR
 *     strategy on ~14 routes and contradicts the decision recorded below about
 *     staying conservative on Netlify Free.
 *   - `'unsafe-inline'` permits exactly the injection a CSP is meant to stop,
 *     so it would buy the appearance of protection and little else.
 *
 * The directives that need no nonce are set below and do carry real value.
 * Adding a nonce-based `script-src` is worth revisiting alongside the
 * cacheComponents migration — at which point it needs, at minimum,
 * `https://js.stripe.com` in script-src, `https://js.stripe.com` +
 * `https://hooks.stripe.com` + `https://m.stripe.network` in frame-src, and
 * `https://api.stripe.com` + `https://m.stripe.network` + `https://r.stripe.com`
 * in connect-src.
 *
 * Note Supabase needs NO connect-src entry: despite the `NEXT_PUBLIC_` prefix
 * on its URL, every Supabase client in this app is server-side. Nothing in the
 * browser talks to it.
 */
const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Stops a browser second-guessing a declared Content-Type, which is how a
  // user-supplied file becomes executable script.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Nothing here is meant to be framed. Belt (legacy header) and braces
  // (frame-ancestors below, which supersedes it in modern browsers).
  { key: "X-Frame-Options", value: "DENY" },

  // Two years with preload — the value required for HSTS preload-list
  // submission. Harmless before the domain is submitted.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // A shop needs none of these. Denying them means an injected script or an
  // embedded frame cannot ask for them either.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },

  // Nonce-free directives only, per the note above.
  //   frame-ancestors  no one may frame us (clickjacking on checkout)
  //   base-uri         an injected <base> cannot re-point every relative URL
  //   object-src       no Flash/Java/legacy plugin surface
  //   form-action      a form cannot be made to POST off-site
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join("; "),
  },
];

/**
 * Allow the R2 custom domain that hosts uploaded images.
 *
 * Derived from `R2_PUBLIC_BASE_URL` so the one env var drives both URL
 * construction (in `src/lib/media/r2.ts`) and this allowlist — they cannot
 * drift. Empty until R2 is configured, which is fine: nothing serves an
 * absolute image URL until then. Uploaded images are rendered `unoptimized`
 * (see `components/ui/photo.tsx`), so this is a belt-and-braces allowance in
 * case a future optimised path is added.
 */
function r2RemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return [];
  try {
    const { protocol, hostname } = new URL(base);
    return [{ protocol: protocol.replace(":", "") as "http" | "https", hostname }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    /**
     * Next 16 narrowed the default `qualities` to `[75]` only, and coerces any
     * other value to the nearest allowed one. This is a fashion house — gown
     * photography is the product, so we allow higher fidelity for hero and PDP
     * imagery while keeping 75 for thumbnails and grids.
     */
    qualities: [75, 85, 90],
    formats: ["image/avif", "image/webp"],
    remotePatterns: r2RemotePatterns(),
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  experimental: {
    serverActions: {
      /**
       * The admin photo upload posts a resized WebP as multipart/form-data. The
       * default Server Action body cap is 1MB — below the 2,000,000-byte guard in
       * `lib/media/actions.ts`, so a detailed 1600px photo (this house sells
       * heavily beaded gowns, the worst case for WebP) could be rejected by the
       * framework with a generic error *before* that friendly check ran. "2mb"
       * (2,097,152 bytes) sits above the guard with room for multipart overhead.
       */
      bodySizeLimit: "2mb",
    },
  },

  /**
   * Not enabling `cacheComponents` (Next 16's Partial Prerendering) yet.
   *
   * It is the direction Next.js is heading and we should adopt it, but it
   * requires deploy-platform support and we are launching on Netlify Free.
   * Enabling it also makes every uncached data access outside <Suspense> a
   * build failure, which is a poor trade while the route tree is still forming.
   *
   * Revisit once the site is deployed and stable — the migration path is
   * documented at node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md
   */
};

export default nextConfig;
