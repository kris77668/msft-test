import { describe, it, expect } from "vitest";
import Stripe from "stripe";

/**
 * Webhook security and replay protection.
 *
 * Covers the two ways this endpoint can go badly wrong:
 *   - accepting a payload Stripe did not sign (anyone could mark orders paid)
 *   - processing the same event twice (double emails, double confirmations)
 *
 * Uses a local secret and Stripe's own test-header helper, so no network calls.
 */

const SECRET = "whsec_test_secret_for_signature_verification";
const stripe = new Stripe("sk_test_dummy", { apiVersion: "2026-06-24.dahlia" });

function makeEvent(id = "evt_test_1") {
  return JSON.stringify({
    id,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_test_1",
        object: "payment_intent",
        amount: 240_000,
        currency: "aud",
        metadata: { purpose: "order", order_id: "11111111-1111-1111-1111-111111111111" },
      },
    },
  });
}

describe("stripe webhook signature", () => {
  it("accepts a correctly signed payload", () => {
    const payload = makeEvent();
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });

    const event = stripe.webhooks.constructEvent(payload, header, SECRET);
    expect(event.id).toBe("evt_test_1");
    expect(event.type).toBe("payment_intent.succeeded");
  });

  it("rejects a payload signed with a different secret", () => {
    // This is the production-secret-used-locally mistake, and the failure looks
    // like a routing bug unless you know to check the secret.
    const payload = makeEvent();
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_a_different_environment",
    });

    expect(() => stripe.webhooks.constructEvent(payload, header, SECRET)).toThrow();
  });

  it("rejects a payload tampered with after signing", () => {
    // The attack that matters: take a real $1 event and rewrite the amount.
    const original = makeEvent();
    const header = stripe.webhooks.generateTestHeaderString({ payload: original, secret: SECRET });
    const tampered = original.replace('"amount":240000', '"amount":1');

    expect(() => stripe.webhooks.constructEvent(tampered, header, SECRET)).toThrow();
  });

  it("rejects an old signature outside the tolerance window", () => {
    // Replay of a captured request hours later.
    const payload = makeEvent();
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 60 * 60,
    });

    expect(() => stripe.webhooks.constructEvent(payload, header, SECRET, 300)).toThrow();
  });

  it("rejects a missing signature header", () => {
    expect(() => stripe.webhooks.constructEvent(makeEvent(), "", SECRET)).toThrow();
  });
});

// ── Replay protection, against the real ledger table ──────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

describe.runIf(url && secretKey)("processed_stripe_events ledger", () => {
  const headers = {
    apikey: secretKey!,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
  };

  const insert = (eventId: string) =>
    fetch(`${url}/rest/v1/processed_stripe_events`, {
      method: "POST",
      headers,
      body: JSON.stringify({ event_id: eventId, event_type: "payment_intent.succeeded" }),
    });

  it("claims an event once and rejects the replay", async () => {
    const eventId = `evt_vitest_${Date.now()}`;

    const first = await insert(eventId);
    expect(first.ok).toBe(true);

    // The retry. Must be refused with unique_violation so the handler exits
    // early rather than confirming the order a second time.
    const replay = await insert(eventId);
    expect(replay.ok).toBe(false);
    const body = (await replay.json()) as { code?: string };
    expect(body.code).toBe("23505");

    await fetch(`${url}/rest/v1/processed_stripe_events?event_id=eq.${eventId}`, {
      method: "DELETE",
      headers,
    });
  });
});
