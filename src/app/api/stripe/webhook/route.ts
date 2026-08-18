import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleStripeEvent } from "@/lib/stripe/handle-event";
import { PG_UNIQUE_VIOLATION } from "@/lib/supabase/errors";

/**
 * Stripe webhook receiver.
 *
 * THIS IS THE SOURCE OF TRUTH FOR PAYMENT. Not the browser redirect — customers
 * close the tab, lose signal, and hit back. An order or booking becomes
 * confirmed here or not at all.
 *
 * Three things this file must never stop doing:
 *
 *  1. Run on the Node runtime. Signature verification needs the raw body and
 *     node crypto; on edge, `constructEvent` fails.
 *  2. Read the body as TEXT before anything else. Calling `req.json()` first
 *     re-serialises it, the bytes no longer match what Stripe signed, and every
 *     signature check fails with an error that looks like a config problem.
 *  3. Deduplicate through `processed_stripe_events`. Stripe retries aggressively
 *     on any non-2xx and can deliver the same event more than once even on
 *     success. Without the ledger, a retry double-confirms a booking and sends
 *     a second confirmation email.
 *
 * The ledger records a CLAIM and, separately, a COMPLETION. That distinction is
 * the point: the row used to be written before the handler ran and treated as
 * proof of processing, so a crash or timeout in between left the event marked
 * done forever — the customer charged, the order stuck on pending_payment, and
 * Stripe told not to retry. A claim without `completed_at`, older than the
 * staleness window, is now reprocessed instead of acknowledged.
 */
export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Raw body, before any parsing.
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      getEnv().STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    // A failure here means the payload was not signed by Stripe with our
    // secret — either a spoofed request or the wrong environment's secret.
    // Never process it, and never echo the reason back to the caller.
    console.error("[stripe] signature verification failed:", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();

  // Claim the event. The primary key makes this atomic: exactly one delivery
  // wins the insert, any duplicate hits the conflict and is resolved below.
  const { error: claimError } = await supabase
    .from("processed_stripe_events")
    .insert({ event_id: event.id, event_type: event.type });

  if (claimError) {
    // unique_violation. NOT automatically a duplicate: the row records that the
    // event was CLAIMED, and until `completed_at` is set we do not know whether
    // the handler ever finished.
    if (claimError.code === PG_UNIQUE_VIOLATION) {
      const resolution = await resolveExistingClaim(supabase, event.id);

      if (resolution === "completed") {
        return Response.json({ received: true, duplicate: true });
      }

      if (resolution === "in-flight") {
        // Another delivery is mid-handler right now. Do not run a second copy
        // concurrently — ask Stripe to come back.
        return new Response("Already in progress", { status: 409 });
      }
      // "abandoned" — a previous attempt claimed the event and then died before
      // finishing (a crash, or a function timeout: Netlify Free caps these at
      // 10s and the handlers make several round trips). Left alone, that event
      // was marked done forever while the order sat unconfirmed and the customer
      // stayed charged. Fall through and reprocess it.
    } else {
      // Could not record the claim at all, so we must NOT process the event —
      // doing so risks handling it twice later. 500 so Stripe retries once the
      // database is healthy again.
      console.error("[stripe] could not claim event:", claimError.message);
      return new Response("Ledger unavailable", { status: 500 });
    }
  }

  try {
    await handleStripeEvent(event);

    // Only now is the event genuinely processed.
    const { error: completeError } = await supabase
      .from("processed_stripe_events")
      .update({ completed_at: new Date().toISOString() })
      .eq("event_id", event.id);

    if (completeError) {
      // The work is done but unrecorded. Say so loudly: a retry will reprocess,
      // and every handler is written to be idempotent for exactly this reason.
      console.error(
        `[stripe] handled ${event.id} but could not mark it complete:`,
        completeError.message
      );
    }

    return Response.json({ received: true });
  } catch (err) {
    // Release the claim so the retry can reprocess immediately, rather than
    // waiting out the staleness window. This covers the handled error; the
    // `completed_at` marker covers the crash this line cannot run for.
    await supabase.from("processed_stripe_events").delete().eq("event_id", event.id);

    console.error(`[stripe] handler failed for ${event.type} (${event.id}):`, err);
    return new Response("Handler error", { status: 500 });
  }
}

/**
 * How long a claim may sit unfinished before another delivery may take it over.
 *
 * Comfortably longer than any real handler — the platform kills a function well
 * before this — so a claim still open past it was abandoned, not running.
 */
const CLAIM_STALE_MS = 60_000;

async function resolveExistingClaim(
  supabase: ReturnType<typeof createAdminClient>,
  eventId: string
): Promise<"completed" | "in-flight" | "abandoned"> {
  const { data, error } = await supabase
    .from("processed_stripe_events")
    .select("completed_at, processed_at")
    .eq("event_id", eventId)
    .maybeSingle();

  // Can't tell. Treat as complete rather than risk running a handler twice —
  // the conservative direction when the ledger itself is unreadable.
  if (error || !data) return "completed";
  if (data.completed_at) return "completed";

  const claimedAt = new Date(data.processed_at).getTime();
  return Date.now() - claimedAt > CLAIM_STALE_MS ? "abandoned" : "in-flight";
}
