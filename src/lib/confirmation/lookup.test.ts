import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Confirmation-token lookups.
 *
 * The token IS the credential for a guest order, so these reads use the admin
 * client and the token match is the only thing standing between a caller and
 * someone else's order. The behaviour that matters here: an unknown token and an
 * expired-but-valid token get DIFFERENT results (so they can be messaged
 * differently), and the embedded to-one relations are unwrapped whether Postgres
 * returns an object or a single-element array.
 */

vi.mock("server-only", () => ({}));

let mockResult: { data: unknown } = { data: null };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = async () => mockResult;
    return { from: () => chain };
  },
}));

import { lookupOrder, lookupBooking } from "./lookup";

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

beforeEach(() => {
  mockResult = { data: null };
});

describe("lookupOrder", () => {
  it("returns not-found for an unknown token", async () => {
    mockResult = { data: null };
    expect(await lookupOrder("nope")).toEqual({ state: "not-found" });
  });

  it("distinguishes an expired token from a wrong one", async () => {
    mockResult = {
      data: {
        order_number: "MFT-1",
        status: "paid",
        total_cents: 100,
        gst_cents: 9,
        email: "a@b.com",
        confirmation_expires_at: past,
        order_items: [],
      },
    };
    expect(await lookupOrder("old")).toEqual({ state: "expired" });
  });

  it("returns the mapped order for a valid token", async () => {
    mockResult = {
      data: {
        order_number: "MFT-2",
        status: "paid",
        total_cents: 240000,
        gst_cents: 21818,
        email: "bride@example.com",
        confirmation_expires_at: future,
        order_items: [
          { product_name: "Aria Gown", size: "10", qty: 1, unit_price_cents: 240000 },
        ],
      },
    };

    const result = await lookupOrder("good");
    expect(result.state).toBe("found");
    if (result.state !== "found") return;
    expect(result.data.orderNumber).toBe("MFT-2");
    expect(result.data.items).toEqual([
      { productName: "Aria Gown", size: "10", qty: 1, unitPriceCents: 240000 },
    ]);
  });
});

describe("lookupBooking", () => {
  it("unwraps an embedded relation returned as an array", async () => {
    mockResult = {
      data: {
        status: "confirmed",
        deposit_cents: 10000,
        email: "bride@example.com",
        first_name: "Ada",
        confirmation_expires_at: future,
        availability_slots: [{ starts_at: "2026-07-21T00:30:00Z" }],
        consultation_types: [{ label: "Bridal" }],
      },
    };

    const result = await lookupBooking("good");
    expect(result.state).toBe("found");
    if (result.state !== "found") return;
    expect(result.data.startsAt).toBe("2026-07-21T00:30:00Z");
    expect(result.data.typeLabel).toBe("Bridal");
  });

  it("unwraps an embedded relation returned as a bare object", async () => {
    mockResult = {
      data: {
        status: "confirmed",
        deposit_cents: 10000,
        email: "bride@example.com",
        first_name: "Ada",
        confirmation_expires_at: future,
        availability_slots: { starts_at: "2026-07-21T00:30:00Z" },
        consultation_types: { label: "Evening" },
      },
    };

    const result = await lookupBooking("good");
    if (result.state !== "found") throw new Error("expected found");
    expect(result.data.startsAt).toBe("2026-07-21T00:30:00Z");
    expect(result.data.typeLabel).toBe("Evening");
  });

  it("returns not-found for an unknown token", async () => {
    mockResult = { data: null };
    expect(await lookupBooking("nope")).toEqual({ state: "not-found" });
  });
});
