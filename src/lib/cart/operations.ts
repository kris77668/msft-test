import {
  cartLineId,
  type CartLine,
  type CartableProduct,
} from "@/lib/products/types";

/**
 * Pure cart operations.
 *
 * Immutable throughout. The prototype mutated shared arrays in place
 * (`ex.qty++`, `.splice`, `.length = 0`) and forced re-renders with
 * `useReducer(x => x + 1, 0)`. That breaks under React 18+ concurrent rendering
 * and `useSyncExternalStore`, and addressing lines by array index meant a
 * concurrent reorder mutated the wrong line.
 *
 * The signature is the point: `product: CartableProduct` cannot accept a
 * BespokeGown. See ./operations.type-test.ts for the compile-time proof.
 */

const MAX_QTY_PER_LINE = 10;

export function addLine(
  lines: readonly CartLine[],
  product: CartableProduct,
  size: string,
  qty = 1
): readonly CartLine[] {
  const lineId = cartLineId(product.id, size);
  const existing = lines.find((l) => l.lineId === lineId);

  if (existing) {
    return lines.map((l) =>
      l.lineId === lineId
        ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY_PER_LINE) }
        : l
    );
  }

  return [
    ...lines,
    { lineId, productId: product.id, size, qty: Math.min(qty, MAX_QTY_PER_LINE) },
  ];
}

export function removeLine(
  lines: readonly CartLine[],
  lineId: string
): readonly CartLine[] {
  return lines.filter((l) => l.lineId !== lineId);
}

/**
 * Setting quantity to zero removes the line. The prototype floored at 1, so the
 * minus button became a no-op at quantity 1 and there was no way to empty a line
 * except the separate remove control.
 */
export function setQty(
  lines: readonly CartLine[],
  lineId: string,
  qty: number
): readonly CartLine[] {
  if (qty <= 0) return removeLine(lines, lineId);
  return lines.map((l) =>
    l.lineId === lineId ? { ...l, qty: Math.min(qty, MAX_QTY_PER_LINE) } : l
  );
}

export function clearLines(): readonly CartLine[] {
  return [];
}

export function totalQty(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
