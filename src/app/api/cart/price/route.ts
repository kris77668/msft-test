import { priceRawCart } from "@/lib/cart/pricing";
import { allowByIp, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Prices a cart for non-browser clients.
 *
 * The website calls the `getPricedCart` server action instead; both share
 * `priceRawCart`, so the bag total shown in the app and on the site is computed
 * once, in one place.
 *
 * Accepts `{ lines: [{ lineId, productId, size, qty }] }` and returns a
 * `PricedCart`. The request carries no prices and none are accepted if sent —
 * every amount comes from the database.
 *
 * `unavailable` lists the `lineId`s that could not be priced, because the piece
 * was unpublished, archived, or is bespoke and therefore not sellable. Clients
 * must surface these per line: dropping them silently would show a total for a
 * bag the customer cannot actually buy.
 *
 * Rate-limited like every other route handler. This was the one endpoint
 * without a limit, and it is the one that fans out to a database query with up
 * to MAX_LINES product ids per call. The website is unaffected either way — it
 * uses the server action, not this route — so the limit constrains only
 * non-browser clients, and `cartPriceIp` is set well above what a person
 * reviewing their bag would ever reach.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await allowByIp("cart-price", RATE_LIMITS.cartPriceIp))) {
    return Response.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as { lines?: unknown } | null;

  const priced = await priceRawCart(body?.lines);

  return Response.json(priced);
}
