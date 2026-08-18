import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Stripe from "stripe";

/**
 * Stripe event dispatch — the source of truth for payment.
 *
 * The webhook signature suite (webhook.test.ts) proves a forged payload is
 * rejected; this proves what happens to a GENUINE one. Every write is
 * conditional on current state, so the cases that matter are the ones where the
 * state has moved: a replay must not double-send, a lapsed hold must be reported
 * for a human rather than silently confirmed, and a partial refund must not flip
 * an order that still shipped.
 *
 * The Supabase client is a queue-driven mock: each awaited chain or maybeSingle
 * consumes the next configured result, in the order the handler reads them.
 */

vi.mock("server-only", () => ({}));

let resultQueue: Array<{ data?: unknown; error?: unknown }> = [];
const updateArgs: unknown[] = [];

function nextResult() {
  return resultQueue.length ? resultQueue.shift()! : { data: null, error: null };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    const pass = () => chain;
    chain.select = pass;
    chain.eq = pass;
    chain.in = pass;
    chain.delete = pass;
    chain.insert = pass;
    chain.update = (payload: unknown) => {
      updateArgs.push(payload);
      return chain;
    };
    chain.maybeSingle = async () => nextResult();
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(nextResult()).then(resolve);
    return { from: () => chain };
  },
}));

const sendOnce = vi.fn(async (..._args: unknown[]) => ({ status: "sent" as const }));
vi.mock("@/lib/email/send-once", () => ({ sendOnce: (...a: unknown[]) => sendOnce(...a) }));

vi.mock("@/lib/site/settings", () => ({
  getSiteSettings: async () => ({
    studioName: "Ms Fairy Tale",
    legalName: null,
    abn: null, // isValidAbn(null) → false, so the invoice business block is null
    contentIsPlaceholder: true,
    openingHours: null,
  }),
  formatAddress: () => null,
}));

vi.mock("@/lib/email/order-confirmation", () => ({
  orderConfirmationEmail: () => ({ subject: "order", html: "<p>order</p>" }),
}));
vi.mock("@/lib/email/booking-confirmation", () => ({
  bookingConfirmationEmail: () => ({ subject: "booking", html: "<p>booking</p>" }),
}));

import { handleStripeEvent } from "./handle-event";

function intent(metadata: Record<string, string>): Stripe.Event {
  return {
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_1", amount: 240000, currency: "aud", metadata } },
  } as unknown as Stripe.Event;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resultQueue = [];
  updateArgs.length = 0;
  sendOnce.mockClear();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("payment_intent.succeeded — order", () => {
  it("marks the order paid and sends the confirmation once", async () => {
    resultQueue = [
      { data: [{ id: "o1" }] }, // the status-guarded update matched a row
      { data: { order_number: "MFT-1", email: "a@b.com", order_items: [] } },
    ];

    await handleStripeEvent(intent({ purpose: "order", order_id: "o1" }));

    expect(updateArgs[0]).toMatchObject({ status: "paid" });
    expect(sendOnce).toHaveBeenCalledOnce();
  });

  it("still sends on a replay where the order is already paid (no double order)", async () => {
    resultQueue = [
      { data: [] }, // update matched nothing (already paid)
      { data: { status: "paid" } }, // the follow-up status read
      { data: { order_number: "MFT-1", email: "a@b.com", order_items: [] } },
    ];

    await handleStripeEvent(intent({ purpose: "order", order_id: "o1" }));

    // sendOnce is itself idempotent, so calling it here is safe and expected.
    expect(sendOnce).toHaveBeenCalledOnce();
  });

  it("reports a charge whose order was cancelled, and does NOT send", async () => {
    resultQueue = [
      { data: [] }, // update matched nothing
      { data: { status: "cancelled" } }, // status read
      { data: { status: "cancelled" } }, // reportUnreconciledPayment re-reads
    ];

    await handleStripeEvent(intent({ purpose: "order", order_id: "o1" }));

    expect(sendOnce).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("MANUAL REFUND REQUIRED")
    );
  });
});

describe("payment_intent.succeeded — consultation", () => {
  it("confirms the booking and sends once", async () => {
    resultQueue = [
      { data: [{ id: "c1" }] }, // hold → confirmed update matched
      {
        data: {
          email: "bride@example.com",
          first_name: "Ada",
          deposit_cents: 10000,
          availability_slots: { starts_at: "2026-07-21T00:30:00Z" },
          consultation_types: { label: "Bridal" },
        },
      },
    ];

    await handleStripeEvent(intent({ purpose: "consultation", consultation_id: "c1" }));

    expect(updateArgs[0]).toMatchObject({ status: "confirmed", hold_expires_at: null });
    expect(sendOnce).toHaveBeenCalledOnce();
  });

  it("reports a paid deposit whose hold had already lapsed", async () => {
    resultQueue = [
      { data: [] }, // update matched nothing — the hold was released
      { data: { status: "cancelled" } }, // status re-read: not 'confirmed'
      { data: { status: "cancelled" } }, // reportUnreconciledPayment read
    ];

    await handleStripeEvent(intent({ purpose: "consultation", consultation_id: "c1" }));

    expect(sendOnce).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("MANUAL REFUND REQUIRED")
    );
  });

  it("still confirms on a replay whose booking is already confirmed (no false alarm)", async () => {
    resultQueue = [
      { data: [] }, // update matched nothing — already confirmed
      { data: { status: "confirmed" } }, // status re-read: a benign replay
      {
        data: {
          email: "bride@example.com",
          first_name: "Ada",
          deposit_cents: 10000,
          availability_slots: { starts_at: "2026-07-21T00:30:00Z" },
          consultation_types: { label: "Bridal" },
        },
      }, // sendBookingConfirmation read
    ];

    await handleStripeEvent(intent({ purpose: "consultation", consultation_id: "c1" }));

    // The booking is fine, so the confirmation is (idempotently) sent and NO
    // manual-refund alarm is raised — the bug was reporting this replay as one.
    expect(sendOnce).toHaveBeenCalledOnce();
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("MANUAL REFUND REQUIRED")
    );
  });
});

describe("charge.refunded", () => {
  function refund(amount_refunded: number, amount: number): Stripe.Event {
    return {
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_1", amount_refunded, amount } },
    } as unknown as Stripe.Event;
  }

  it("flips a fully refunded order to refunded", async () => {
    resultQueue = [{ data: [{ id: "o1" }] }];

    await handleStripeEvent(refund(240000, 240000));

    expect(updateArgs[0]).toMatchObject({ status: "refunded" });
  });

  it("leaves a partial refund alone — the goods still shipped", async () => {
    await handleStripeEvent(refund(100, 240000));

    expect(updateArgs).toHaveLength(0);
  });
});
