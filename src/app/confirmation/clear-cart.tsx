"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/store";

/**
 * Empties the cart once an order is confirmed paid.
 *
 * Rendered only on the success branch, so a declined card leaves the bag intact
 * and the customer can retry without rebuilding it.
 */
export function ClearCartOnMount() {
  const clear = useCart((s) => s.clear);
  useEffect(() => clear(), [clear]);
  return null;
}
