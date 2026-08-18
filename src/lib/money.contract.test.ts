import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatMoney,
  formatMoneyRange,
  gstComponent,
  exGstAmount,
  instalmentAmount,
} from "./money";

/**
 * The TypeScript half of the shared money contract.
 *
 * `contracts/money-vectors.json` is asserted by this suite and by
 * `test/money_contract_test.dart` in the Flutter repo. Two implementations,
 * one specification — the only way to keep a Dart port honest when it cannot
 * import the original.
 *
 * A failure here means either this implementation drifted, or the contract
 * changed and the app has not caught up. Both are worth stopping for.
 */

interface Vectors {
  format: { cents: number; expected: string }[];
  formatRange: { fromCents: number; toCents: number; expected: string }[];
  gstComponent: { inclusiveCents: number; expected: number }[];
  exGst: { inclusiveCents: number; expected: number }[];
  instalment: { totalCents: number; instalments: number; expected: number }[];
}

const vectors: Vectors = JSON.parse(
  readFileSync(join(process.cwd(), "contracts", "money-vectors.json"), "utf8")
);

describe("money contract", () => {
  it("formats every vector", () => {
    for (const v of vectors.format) {
      expect(formatMoney(v.cents), `formatMoney(${v.cents})`).toBe(v.expected);
    }
  });

  it("formats every range vector", () => {
    for (const v of vectors.formatRange) {
      expect(
        formatMoneyRange(v.fromCents, v.toCents),
        `formatMoneyRange(${v.fromCents}, ${v.toCents})`
      ).toBe(v.expected);
    }
  });

  it("extracts GST for every vector", () => {
    for (const v of vectors.gstComponent) {
      expect(gstComponent(v.inclusiveCents), `gstComponent(${v.inclusiveCents})`).toBe(
        v.expected
      );
    }
  });

  it("computes ex-GST for every vector", () => {
    for (const v of vectors.exGst) {
      expect(exGstAmount(v.inclusiveCents), `exGstAmount(${v.inclusiveCents})`).toBe(
        v.expected
      );
    }
  });

  it("splits instalments for every vector", () => {
    for (const v of vectors.instalment) {
      expect(
        instalmentAmount(v.totalCents, v.instalments),
        `instalmentAmount(${v.totalCents}, ${v.instalments})`
      ).toBe(v.expected);
    }
  });

  it("keeps GST and ex-GST summing to the total", () => {
    // Not a vector — a property. Any rounding rule that breaks this produces
    // a tax invoice whose parts do not add up to its own total.
    for (const cents of [1, 5, 11000, 240000, 340000, 980000, 123457]) {
      expect(gstComponent(cents) + exGstAmount(cents)).toBe(cents);
    }
  });

  it("never quotes instalments summing below the total", () => {
    for (const cents of [1, 3, 100, 240001, 333333, 999999]) {
      expect(instalmentAmount(cents, 4) * 4).toBeGreaterThanOrEqual(cents);
    }
  });
});
