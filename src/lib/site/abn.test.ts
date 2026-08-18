import { describe, it, expect } from "vitest";
import { isValidAbn, formatAbn } from "./abn";

/**
 * The ABN gates whether an order confirmation calls itself a tax invoice, so
 * the cost of a false positive here is a statutory document carrying a wrong
 * or placeholder identifier.
 */

const REAL = "52 613 500 404";

describe("isValidAbn", () => {
  it("accepts the studio's ABN, spaced or bare", () => {
    expect(isValidAbn(REAL)).toBe(true);
    expect(isValidAbn("52613500404")).toBe(true);
    expect(isValidAbn("52-613-500-404")).toBe(true);
  });

  /** The whole reason this is a checksum and not a truthiness check. */
  it("rejects the seeded placeholder that a truthiness check would pass", () => {
    expect(isValidAbn("ABN TO BE CONFIRMED")).toBe(false);
    expect(isValidAbn("TBC")).toBe(false);
  });

  it("rejects empty and missing values", () => {
    expect(isValidAbn(null)).toBe(false);
    expect(isValidAbn(undefined)).toBe(false);
    expect(isValidAbn("")).toBe(false);
    expect(isValidAbn("   ")).toBe(false);
  });

  it("rejects the wrong number of digits", () => {
    expect(isValidAbn("5261350040")).toBe(false); // 10
    expect(isValidAbn("526135004041")).toBe(false); // 12
  });

  it("rejects digit-shaped strings that fail the checksum", () => {
    expect(isValidAbn("00000000000")).toBe(false);
    expect(isValidAbn("12345678901")).toBe(false);
    expect(isValidAbn("11111111111")).toBe(false);
  });

  it("catches a single-digit typo in the real ABN", () => {
    expect(isValidAbn("52 613 500 405")).toBe(false);
    expect(isValidAbn("52 613 500 414")).toBe(false);
  });

  it("catches a transposition in the real ABN", () => {
    // 500 -> 050
    expect(isValidAbn("52 613 050 404")).toBe(false);
  });

  it("rejects anything containing letters", () => {
    expect(isValidAbn("52 613 500 40A")).toBe(false);
  });
});

describe("formatAbn", () => {
  it("groups a valid ABN in the ATO's 2-3-3-3 form", () => {
    expect(formatAbn("52613500404")).toBe(REAL);
    expect(formatAbn(REAL)).toBe(REAL);
  });

  it("returns null for anything invalid, so it cannot launder a bad value", () => {
    expect(formatAbn("ABN TO BE CONFIRMED")).toBeNull();
    expect(formatAbn("12345678901")).toBeNull();
    expect(formatAbn(null)).toBeNull();
  });
});
