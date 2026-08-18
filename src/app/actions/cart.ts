"use server";

import { priceRawCart, type PricedCart } from "@/lib/cart/pricing";

/**
 * Prices the client cart on the server.
 *
 * A thin adapter over `priceRawCart`, which is shared with
 * `POST /api/cart/price` so the website and the mobile app price a bag through
 * the same code. Prices are never sent by the client — the cart stores only
 * `{productId, size, qty}` and the amount is read from the database here.
 */
export async function getPricedCart(rawLines: unknown): Promise<PricedCart> {
  return priceRawCart(rawLines);
}
