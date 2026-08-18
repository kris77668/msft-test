/**
 * End-to-end webhook check against a running dev server.
 *
 * Proves the deployed route — not just the Stripe library — verifies signatures
 * and refuses replays.
 *
 * Usage:  npm run dev    (in another terminal)
 *         node --env-file=.env.local scripts/check-webhook.mjs
 */

import Stripe from "stripe";

const ENDPOINT = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/stripe/webhook`;
const SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe("sk_test_dummy", { apiVersion: "2026-06-24.dahlia" });

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

const eventId = `evt_check_${Date.now()}`;
const payload = JSON.stringify({
  id: eventId,
  object: "event",
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: `pi_check_${Date.now()}`,
      object: "payment_intent",
      amount: 240000,
      currency: "aud",
      // No recognised purpose: the handler should log and acknowledge rather
      // than throw, so this exercises the full path without touching real orders.
      metadata: {},
    },
  },
});

const post = (body, header) =>
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(header ? { "stripe-signature": header } : {}) },
    body,
  });

// 1 — a correctly signed event is accepted
const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
const first = await post(payload, header);
const firstBody = await first.json().catch(() => ({}));
check("accepts a correctly signed event", first.status === 200 && firstBody.received === true, `HTTP ${first.status} ${JSON.stringify(firstBody)}`);

// 2 — the same event replayed is recognised as a duplicate, not reprocessed
const replay = await post(payload, header);
const replayBody = await replay.json().catch(() => ({}));
check("treats a replay as a duplicate", replay.status === 200 && replayBody.duplicate === true, `HTTP ${replay.status} ${JSON.stringify(replayBody)}`);

// 3 — a tampered body is rejected
const tampered = payload.replace('"amount":240000', '"amount":1');
const bad = await post(tampered, header);
check("rejects a tampered payload", bad.status === 400, `HTTP ${bad.status}`);

// 4 — a payload signed with the wrong secret is rejected
const wrong = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong_environment" });
const wrongRes = await post(payload, wrong);
check("rejects a foreign signature", wrongRes.status === 400, `HTTP ${wrongRes.status}`);

// 5 — no signature at all is rejected
const none = await post(payload, null);
check("rejects a missing signature", none.status === 400, `HTTP ${none.status}`);

for (const { name, pass, detail } of results) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name.padEnd(38)} ${detail}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
console.log(`\nLedger row ${eventId} left in place intentionally — it is the proof the replay was blocked.`);
if (failed.length) process.exitCode = 1;
