import { describe, it, expect } from "vitest";
import { parseCartLines, MAX_QTY_PER_LINE, MAX_LINES } from "./parse";

/**
 * The cart payload boundary.
 *
 * This is where a hand-edited localStorage entry or a forged request body meets
 * the server. It used to be two copies of a zod schema whose results were each
 * cast through `unknown` into the branded cart type — so the compiler certified
 * an attacker's uuid as cart-eligible without anything having checked it.
 */

const validLine = {
  lineId: "abc::AU 10",
  productId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  size: "AU 10",
  qty: 2,
};

describe("parseCartLines", () => {
  it("accepts a well-formed payload", () => {
    expect(parseCartLines([validLine])).toEqual([validLine]);
  });

  it("accepts an empty cart", () => {
    expect(parseCartLines([])).toEqual([]);
  });

  it("rejects a non-array", () => {
    expect(parseCartLines(null)).toBeNull();
    expect(parseCartLines(undefined)).toBeNull();
    expect(parseCartLines({})).toBeNull();
    expect(parseCartLines("[]")).toBeNull();
  });

  it("rejects a productId that is not a uuid", () => {
    // The single most important check here: everything downstream looks this id
    // up in the database, and a non-uuid is either a bug or an attempt.
    expect(parseCartLines([{ ...validLine, productId: "not-a-uuid" }])).toBeNull();
    expect(parseCartLines([{ ...validLine, productId: "" }])).toBeNull();
  });

  it("rejects quantities outside the database's own bounds", () => {
    // cart_items carries check (qty > 0 and qty <= 10); the schema must not be
    // looser than the constraint or the insert fails at the wrong layer.
    expect(parseCartLines([{ ...validLine, qty: 0 }])).toBeNull();
    expect(parseCartLines([{ ...validLine, qty: -1 }])).toBeNull();
    expect(parseCartLines([{ ...validLine, qty: MAX_QTY_PER_LINE + 1 }])).toBeNull();
    expect(parseCartLines([{ ...validLine, qty: 1.5 }])).toBeNull();
    expect(parseCartLines([{ ...validLine, qty: "2" }])).toBeNull();
  });

  it("accepts the exact quantity boundary", () => {
    expect(parseCartLines([{ ...validLine, qty: 1 }])).not.toBeNull();
    expect(parseCartLines([{ ...validLine, qty: MAX_QTY_PER_LINE }])).not.toBeNull();
  });

  it("caps the number of lines", () => {
    const many = Array.from({ length: MAX_LINES }, (_, i) => ({
      ...validLine,
      lineId: `line-${i}`,
    }));

    expect(parseCartLines(many)).not.toBeNull();
    expect(parseCartLines([...many, { ...validLine, lineId: "one-too-many" }])).toBeNull();
  });

  it("rejects an empty or oversized size", () => {
    expect(parseCartLines([{ ...validLine, size: "" }])).toBeNull();
    expect(parseCartLines([{ ...validLine, size: "x".repeat(21) }])).toBeNull();
  });

  it("rejects a line missing required fields", () => {
    expect(parseCartLines([{ productId: validLine.productId, qty: 1 }])).toBeNull();
  });

  it("does not let extra properties through", () => {
    // A payload carrying a price must not smuggle it into anything downstream:
    // the whole point is that the browser never states what something costs.
    const parsed = parseCartLines([{ ...validLine, priceCents: 1 }]);

    expect(parsed).not.toBeNull();
    expect(parsed![0]).not.toHaveProperty("priceCents");
  });
});
