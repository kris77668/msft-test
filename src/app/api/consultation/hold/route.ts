import { z } from "zod";
import { getStripe, CURRENCY } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowByIp, RATE_LIMITS } from "@/lib/rate-limit";
import { PG_UNIQUE_VIOLATION } from "@/lib/supabase/errors";

export const runtime = "nodejs";

/**
 * Holds a consultation slot and creates its deposit PaymentIntent.
 *
 * The slot is claimed BEFORE payment, with a 15-minute hold, so it cannot be
 * taken out from under someone mid-checkout. Concurrency is settled by the
 * partial unique index `consultations_one_live_per_slot`: two people submitting
 * the same 2:30pm produce one winner and one unique-violation, which becomes a
 * clean 409 rather than a double booking.
 *
 * The deposit amount is read from `consultation_types`, never from the request —
 * the client cannot choose what it pays.
 */

const HOLD_MINUTES = 15;

const bodySchema = z.object({
  slotId: z.string().uuid(),
  typeKey: z.enum(["bridal", "evening", "alteration"]),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(6).max(40),
  eventDate: z.string().date().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request): Promise<Response> {
  if (!(await allowByIp("consultation", RATE_LIMITS.consultationIp))) {
    return Response.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = createAdminClient();

  // Deposit comes from the database — one source, changeable without a deploy.
  const { data: type } = await supabase
    .from("consultation_types")
    .select("deposit_cents, label")
    .eq("key", input.typeKey)
    .maybeSingle();

  if (!type) return Response.json({ error: "Unknown consultation type" }, { status: 400 });

  // Reject slots that are blocked or already in the past.
  const { data: slot } = await supabase
    .from("availability_slots")
    .select("id, starts_at, is_blocked")
    .eq("id", input.slotId)
    .maybeSingle();

  if (!slot || slot.is_blocked || new Date(slot.starts_at) <= new Date()) {
    return Response.json({ error: "That time is no longer available" }, { status: 409 });
  }

  // Release any lapsed hold on THIS slot before attempting the insert.
  //
  // This ordering is load-bearing, not tidiness. `consultations_one_live_per_slot`
  // is a partial unique index over status in ('pending_payment','confirmed'), and
  // Postgres will not accept `hold_expires_at > now()` in an index predicate
  // because now() is not IMMUTABLE. So a lapsed hold keeps occupying its slot at
  // the index level regardless of what any query believes. get_available_slots
  // now ignores expired holds, which means without this call the calendar would
  // offer the slot and the insert below would then fail with a unique violation
  // the customer reads as "that time was just taken" — worse than the bug it
  // replaced. The row has to actually change status first.
  //
  // Concurrency is unchanged: if two people race, both expire the same stale row
  // (idempotent), and the unique index still lets exactly one insert win.
  const { error: expireError } = await supabase.rpc("expire_stale_consultation_holds", {
    p_slot_id: input.slotId,
  });

  if (expireError) {
    // Non-fatal: the worst case is the insert 409s on a hold that had lapsed,
    // which is the pre-existing behaviour rather than a new failure.
    console.error("[consultation] hold expiry sweep failed:", expireError.message);
  }

  const { data: consultation, error } = await supabase
    .from("consultations")
    .insert({
      slot_id: input.slotId,
      type_key: input.typeKey,
      status: "pending_payment",
      hold_expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
      deposit_cents: type.deposit_cents,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      event_date: input.eventDate || null,
      notes: input.notes ?? null,
    })
    .select("id, confirmation_token")
    .single();

  if (error) {
    // unique_violation on consultations_one_live_per_slot: somebody claimed this
    // slot microseconds earlier.
    if (error.code === PG_UNIQUE_VIOLATION) {
      return Response.json(
        { error: "That time was just taken. Please choose another." },
        { status: 409 }
      );
    }
    console.error("[consultation] insert failed:", error.message);
    return Response.json({ error: "Could not hold that time" }, { status: 500 });
  }

  // A free consultation needs no payment step — deposit_cents can be set to 0
  // in the database to switch the whole flow over.
  if (type.deposit_cents === 0) {
    await supabase
      .from("consultations")
      .update({ status: "confirmed", hold_expires_at: null })
      .eq("id", consultation.id);

    return Response.json({ free: true, confirmationToken: consultation.confirmation_token });
  }

  // Native app requests exclude redirect methods: the app's msfairytale://
  // return URL is not yet registered on either platform, so Afterpay/Zip/PayPal
  // would strand the deposit mid-payment. The browser keeps the full set, where
  // a redirect returns to the site. Matches /api/checkout.
  const isApp = req.headers.get("x-mft-client") === "app";

  let intent;
  try {
    intent = await getStripe().paymentIntents.create(
      {
        amount: type.deposit_cents,
        currency: CURRENCY,
        automatic_payment_methods: isApp
          ? { enabled: true, allow_redirects: "never" }
          : { enabled: true },
        receipt_email: input.email,
        description: `${type.label} — deposit`,
        metadata: {
          purpose: "consultation",
          consultation_id: consultation.id,
        },
      },
      { idempotencyKey: `consultation_${consultation.id}` }
    );
  } catch (err) {
    // Release the slot immediately rather than making the next customer wait
    // out the full 15-minute hold for an appointment nobody is paying for.
    await supabase
      .from("consultations")
      .update({ status: "cancelled" })
      .eq("id", consultation.id)
      .eq("status", "pending_payment");

    console.error("[consultation] PaymentIntent create failed:", (err as Error).message);
    return Response.json(
      { error: "We couldn't reach our payment provider. Please try again." },
      { status: 502 }
    );
  }

  // Checked: both the webhook and the confirmation page match on this id.
  const { error: linkError } = await supabase
    .from("consultations")
    .update({ stripe_payment_intent_id: intent.id })
    .eq("id", consultation.id);

  if (linkError) {
    console.error(
      `[consultation] could not link intent ${intent.id} to ${consultation.id}:`,
      linkError.message
    );
  }

  return Response.json({
    clientSecret: intent.client_secret,
    depositCents: type.deposit_cents,
    confirmationToken: consultation.confirmation_token,
  });
}
