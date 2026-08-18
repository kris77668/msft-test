"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  addLine,
  removeLine,
  setQty,
  totalQty,
} from "./operations";
import type { CartLine, CartableProduct } from "@/lib/products/types";

/**
 * Client cart.
 *
 * WHAT IS STORED: `{ lineId, productId, size, qty }` and nothing else.
 *
 * No prices, no names, no images. Display prices are fetched fresh whenever the
 * cart renders, and the authoritative total is recomputed server-side from the
 * database before any PaymentIntent is created. Two consequences, both
 * deliberate:
 *
 *   - A cart restored from localStorage weeks later cannot check out at the old
 *     price. It reprices, and the customer is told if something changed.
 *   - Editing localStorage in devtools achieves nothing. The browser never tells
 *     the server what anything costs.
 *
 * The prototype held a denormalised snapshot including `price`, mutated it in
 * place, and forced re-renders with `useReducer(x => x + 1, 0)` — which breaks
 * under React 18+ concurrent rendering. Everything here is immutable.
 *
 * Only `CartableProduct` can be added; a BespokeGown is rejected by the type
 * system. See lib/products/two-path.type-test.ts.
 */

interface CartState {
  lines: CartLine[];
  /** False until localStorage has been read, so SSR and first paint agree. */
  hydrated: boolean;

  add: (product: CartableProduct, size: string, qty?: number) => void;
  remove: (lineId: string) => void;
  updateQty: (lineId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hydrated: false,

      add: (product, size, qty = 1) =>
        set((state) => ({ lines: [...addLine(state.lines, product, size, qty)] })),

      remove: (lineId) =>
        set((state) => ({ lines: [...removeLine(state.lines, lineId)] })),

      updateQty: (lineId, qty) =>
        set((state) => ({ lines: [...setQty(state.lines, lineId, qty)] })),

      clear: () => set({ lines: [] }),

      count: () => totalQty(get().lines),
    }),
    {
      name: "mft-cart",
      storage: createJSONStorage(() => localStorage),
      // Persist only the lines; `hydrated` is runtime state.
      partialize: (state) => ({ lines: state.lines }) as unknown as CartState,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);

/**
 * Cart count that is SSR-safe.
 *
 * Reading `lines.length` directly during the first client render produces a
 * different value from the server (which has no localStorage), and React logs a
 * hydration mismatch. Returning 0 until rehydration completes keeps the two in
 * agreement; the badge then appears a frame later.
 */
export function useCartCount(): number {
  const hydrated = useCart((s) => s.hydrated);
  const lines = useCart((s) => s.lines);
  return hydrated ? totalQty(lines) : 0;
}
