import { describe, it, expect } from "vitest";
import { checkoutAttemptKey, IDEMPOTENCY_KEY_PATTERN } from "./attempt-key";

const KEY = "a".repeat(32);
const LINE = { productId: "11111111-1111-1111-1111-111111111111", size: "AU 10", qty: 1 };
const OTHER = { productId: "22222222-2222-2222-2222-222222222222", size: "AU 8", qty: 2 };

describe("checkoutAttemptKey", () => {
  it("is stable across identical requests", () => {
    // The whole point: a double-tap must reach Stripe as one attempt.
    expect(checkoutAttemptKey(KEY, 240000, [LINE])).toBe(
      checkoutAttemptKey(KEY, 240000, [LINE])
    );
  });

  it("ignores line order", () => {
    // Cart ordering is a UI detail. If it changed the key, a re-render that
    // reordered the bag would mint a second order for the same purchase.
    expect(checkoutAttemptKey(KEY, 400000, [LINE, OTHER])).toBe(
      checkoutAttemptKey(KEY, 400000, [OTHER, LINE])
    );
  });

  it("changes when quantity changes", () => {
    expect(checkoutAttemptKey(KEY, 240000, [LINE])).not.toBe(
      checkoutAttemptKey(KEY, 480000, [{ ...LINE, qty: 2 }])
    );
  });

  it("changes when size changes", () => {
    // Same price, different garment. Reusing the key here would hand the
    // customer back an order for the wrong size.
    expect(checkoutAttemptKey(KEY, 240000, [LINE])).not.toBe(
      checkoutAttemptKey(KEY, 240000, [{ ...LINE, size: "AU 12" }])
    );
  });

  it("changes when a line is added", () => {
    expect(checkoutAttemptKey(KEY, 240000, [LINE])).not.toBe(
      checkoutAttemptKey(KEY, 400000, [LINE, OTHER])
    );
  });

  it("changes when the total changes even if the lines do not", () => {
    // A repriced gown between attempts. The customer must not be charged the
    // old total because the bag looked the same.
    expect(checkoutAttemptKey(KEY, 240000, [LINE])).not.toBe(
      checkoutAttemptKey(KEY, 250000, [LINE])
    );
  });

  it("separates two customers using the same bag", () => {
    expect(checkoutAttemptKey(KEY, 240000, [LINE])).not.toBe(
      checkoutAttemptKey("b".repeat(32), 240000, [LINE])
    );
  });
});

describe("IDEMPOTENCY_KEY_PATTERN", () => {
  it("accepts a dash-stripped uuid", () => {
    expect(IDEMPOTENCY_KEY_PATTERN.test("f47ac10b58cc4372a5670e02b2c3d479")).toBe(true);
  });

  it("accepts a ulid and a dashed uuid", () => {
    expect(IDEMPOTENCY_KEY_PATTERN.test("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
    expect(IDEMPOTENCY_KEY_PATTERN.test("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("rejects anything too short to be unguessable", () => {
    expect(IDEMPOTENCY_KEY_PATTERN.test("short")).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("")).toBe(false);
  });

  it("rejects header-injection and path characters", () => {
    expect(IDEMPOTENCY_KEY_PATTERN.test("a".repeat(16) + "\nX-Evil: 1")).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("../".repeat(8))).toBe(false);
    expect(IDEMPOTENCY_KEY_PATTERN.test("a".repeat(201))).toBe(false);
  });
});
