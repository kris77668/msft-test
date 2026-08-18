/**
 * COMPILE-TIME PROOF that a bespoke gown cannot enter the cart.
 *
 * This file contains no runtime assertions and is never imported. It is checked
 * by `tsc --noEmit` (npm run typecheck), and it fails the build in BOTH
 * directions:
 *
 *   - If someone widens `addLine` to accept a BespokeGown, the
 *     `@ts-expect-error` directives below become unused, and TypeScript reports
 *     "Unused '@ts-expect-error' directive" — a build failure.
 *   - If someone removes a required field, the positive cases stop compiling.
 *
 * So the guarantee cannot be quietly weakened. If you are here because the build
 * broke, read AGENTS.md before "fixing" it — the constraint is deliberate.
 */

/* eslint-disable @typescript-eslint/no-unused-vars --
   The bindings below exist only to trigger the type errors asserted by the
   expect-error directives. They are never read at runtime.
   (Do not write that directive's full name here — TypeScript scans every
   comment for it and would treat this line as an unused directive.) */

import { addLine } from "@/lib/cart/operations";
import type {
  BespokeGown,
  RtwProduct,
  AccessoryProduct,
  CartLine,
  RtwId,
  BespokeId,
} from "./types";

const lines: readonly CartLine[] = [];

const dress = {
  kind: "rtw",
  id: "00000000-0000-0000-0000-000000000001" as RtwId,
  slug: "iris",
  name: "Iris",
  priceCents: 240_000,
  colour: "Blush",
  sizes: [{ label: "AU 8", inStock: true }],
  images: [],
  facets: [],
  leadTimeNote: null,
  badge: null,
  description: null,
} satisfies RtwProduct;

const gown = {
  kind: "bespoke",
  id: "00000000-0000-0000-0000-000000000002" as BespokeId,
  slug: "aurelie",
  name: "Aurélie",
  priceFromCents: 480_000,
  priceToCents: 620_000,
  images: [],
  facets: [],
  leadTimeNote: null,
  badge: null,
  description: null,
} satisfies BespokeGown;

// ── Allowed: evening wear and accessories are purchasable ─────────────────
addLine(lines, dress, "AU 8");

// ── Forbidden: a commission is not a checkout ─────────────────────────────
// @ts-expect-error a BespokeGown must never be addable to the cart
addLine(lines, gown, "AU 8");

// ── Forbidden: a bespoke gown has no single price to display ──────────────
// @ts-expect-error BespokeGown has no priceCents — only a from/to range
const _price: number = gown.priceCents;

// ── Forbidden: a bespoke gown has no size run; it is made to measure ──────
// @ts-expect-error BespokeGown has no sizes
const _sizes = gown.sizes;

// ── Forbidden: ids are branded, so a gown id cannot be laundered through ──
// @ts-expect-error BespokeId is not assignable to RtwId
const _id: RtwId = gown.id;

// ── Forbidden: a raw string cannot become a product id without parsing ────
// @ts-expect-error string is not assignable to RtwId
const _rawId: RtwId = "00000000-0000-0000-0000-000000000003";

// Referenced so the declarations are not flagged as unused.
export type _Proof = [typeof _price, typeof _sizes, typeof _id, typeof _rawId, AccessoryProduct];
