import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettings, formatAddress } from "@/lib/site/settings";
import { isValidAbn, formatAbn } from "@/lib/site/abn";
import { formatSlotFull } from "@/lib/consultation/slots";
import { sendOnce } from "@/lib/email/send-once";
import { orderConfirmationEmail } from "@/lib/email/order-confirmation";
import { bookingConfirmationEmail } from "@/lib/email/booking-confirmation";

/**
 * Stripe event dispatch.
 *
 * Both payment flows — cart checkout and the consultation deposit — arrive here
 * as `payment_intent` events and are told apart by `metadata.purpose`, which is
 * set when the PaymentIntent is created. Anything without a recognised purpose
 * is acknowledged and ignored rather than throwing, so unrelated dashboard
 * activity does not spam retries.
 *
 * Handlers must be idempotent in their own right. The event ledger prevents
 * re-delivery of the same event, but two DIFFERENT events can describe the same
 * outcome, so every write below is conditional on current state.
 */

export type PaymentPurpose = "order" | "consultation";

export interface PaymentMetadata {
  purpose?: PaymentPurpose;
  order_id?: string;
  consultation_id?: string;
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await onPaymentSucceeded(event.data.object);
      break;

    case "payment_intent.payment_failed":
      await onPaymentFailed(event.data.object);
      break;

    case "charge.refunded":
      await onChargeRefunded(event.data.object);
      break;

    default:
      // Acknowledged, deliberately unhandled.
      break;
  }
}

async function onPaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const meta = intent.metadata as PaymentMetadata;
  const supabase = createAdminClient();

  if (meta.purpose === "order" && meta.order_id) {
    // Conditional on status so a late duplicate cannot resurrect a cancelled
    // order or overwrite one already marked fulfilled.
    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status: "paid", stripe_payment_intent_id: intent.id })
      .eq("id", meta.order_id)
      .eq("status", "pending_payment")
      .select("id");

    if (error) throw new Error(`order ${meta.order_id} update failed: ${error.message}`);

    // Zero rows is normal on a genuine replay (already 'paid'), and abnormal if
    // the order was cancelled — e.g. abandoned by the checkout route after a
    // Stripe error, then paid anyway. Send the confirmation only for an order
    // that is actually paid now; sendOnce makes the replay case a no-op.
    if (!updated || updated.length === 0) {
      const { data: existing } = await supabase
        .from("orders")
        .select("status")
        .eq("id", meta.order_id)
        .maybeSingle();

      if (existing?.status !== "paid") {
        await reportUnreconciledPayment(supabase, meta.order_id, intent, "order");
        return;
      }
    }

    await sendOrderConfirmation(supabase, meta.order_id);
    return;
  }

  if (meta.purpose === "consultation" && meta.consultation_id) {
    // Clearing hold_expires_at is what stops the expiry sweep reclaiming a slot
    // that has just been paid for.
    const { data: updated, error } = await supabase
      .from("consultations")
      .update({
        status: "confirmed",
        hold_expires_at: null,
        stripe_payment_intent_id: intent.id,
      })
      .eq("id", meta.consultation_id)
      .eq("status", "pending_payment")
      .select("id");

    if (error) {
      throw new Error(`consultation ${meta.consultation_id} update failed: ${error.message}`);
    }

    // Zero rows matched. Two very different causes, and only one is a problem —
    // so tell them apart before crying wolf, exactly as the order branch above
    // does. Left unguarded, this reported EVERY replay as a manual-refund case.
    //
    //   - Already 'confirmed': a benign replay. The webhook deliberately
    //     reprocesses claims it could not mark complete (a handler that
    //     confirmed the booking but timed out before its ledger write — likely
    //     here, since sendBookingConfirmation makes a network call under the
    //     10s function cap). Fall through to the send, which sendOnce makes a
    //     no-op.
    //   - Anything else: the hold lapsed and the slot was released (possibly to
    //     someone else) while this deposit was in flight. Money in, nothing
    //     delivered — that needs a person.
    //
    // Does NOT throw for the genuine case either: retrying cannot match a row
    // that will never be pending again, so it is logged in a form easy to alert
    // on. The customer sees the honest "we couldn't confirm this" state on the
    // confirmation page rather than a false success.
    if (!updated || updated.length === 0) {
      const { data: existing } = await supabase
        .from("consultations")
        .select("status")
        .eq("id", meta.consultation_id)
        .maybeSingle();

      if (existing?.status !== "confirmed") {
        await reportUnreconciledPayment(supabase, meta.consultation_id, intent);
        return;
      }
    }

    await sendBookingConfirmation(supabase, meta.consultation_id);
    return;
  }

  console.warn(`[stripe] succeeded intent ${intent.id} had no recognised purpose`);
}

/**
 * A payment succeeded but its record could not be moved to a confirmed state.
 *
 * The usual cause is a consultation hold that lapsed while the payment was in
 * flight, releasing the slot to someone else. Money has been taken and nothing
 * can be delivered, so this needs a human — there is no correct automatic
 * action, and refunding programmatically would be worse than surfacing it.
 *
 * Logged in a fixed, greppable shape so it can be alerted on. Deliberately does
 * not throw: retrying cannot fix it, and throwing would only cycle Stripe
 * through its retry schedule against a row that will never match.
 */
async function reportUnreconciledPayment(
  supabase: ReturnType<typeof createAdminClient>,
  recordId: string,
  intent: Stripe.PaymentIntent,
  kind: "order" | "consultation" = "consultation"
): Promise<void> {
  const table = kind === "order" ? "orders" : "consultations";
  const { data } = await supabase
    .from(table)
    .select("status")
    .eq("id", recordId)
    .maybeSingle();

  console.error(
    `[stripe] MANUAL REFUND REQUIRED — payment ${intent.id} (${intent.amount} ${intent.currency}) ` +
      `succeeded but ${kind} ${recordId} is '${data?.status ?? "missing"}', not pending_payment. ` +
      `The customer has been charged and has no ${kind === "order" ? "order" : "appointment"}.`
  );
}

/** Order confirmation, guarded by the emails_sent ledger. */
async function sendOrderConfirmation(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string
): Promise<void> {
  const [{ data: order }, settings] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "order_number, email, first_name, subtotal_cents, shipping_cents, total_cents, gst_cents, order_items(product_name, size, qty, unit_price_cents)"
      )
      .eq("id", orderId)
      .maybeSingle(),
    getSiteSettings(),
  ]);

  if (!order) {
    console.error(`[stripe] order ${orderId} vanished before its confirmation could be sent`);
    return;
  }

  const { subject, html } = orderConfirmationEmail({
    orderNumber: order.order_number,
    firstName: order.first_name,
    items: (order.order_items ?? []).map((i) => ({
      name: i.product_name,
      size: i.size,
      qty: i.qty,
      unitPriceCents: i.unit_price_cents,
    })),
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    totalCents: order.total_cents,
    gstCents: order.gst_cents,
    // Gated on the ABN being structurally valid, NOT on `contentIsPlaceholder`.
    // The two are confirmed separately: the ABN is known, the studio address is
    // not. See lib/site/abn.ts for why a truthiness check is unsafe here.
    //
    // The address is still gated on the placeholder flag, so an unconfirmed
    // address is omitted from the invoice rather than printed on it. An ABN and
    // the supplier's identity are what the ATO requires; the address is not.
    business: isValidAbn(settings.abn)
      ? {
          // The REGISTERED entity, not the brand: a tax invoice must identify
          // the entity holding the ABN. Falls back to the trading name only
          // when no legal name has been recorded.
          legalName: settings.legalName ?? settings.studioName,
          abn: formatAbn(settings.abn)!,
          address: settings.contentIsPlaceholder ? null : formatAddress(settings),
        }
      : null,
  });

  await sendOnce({
    entityType: "order",
    entityId: orderId,
    template: "order_confirmation",
    to: order.email,
    subject,
    html,
  });
}

/** Booking confirmation, guarded by the emails_sent ledger. */
async function sendBookingConfirmation(
  supabase: ReturnType<typeof createAdminClient>,
  consultationId: string
): Promise<void> {
  const [{ data: booking }, settings] = await Promise.all([
    supabase
      .from("consultations")
      .select(
        "email, first_name, deposit_cents, availability_slots(starts_at), consultation_types(label)"
      )
      .eq("id", consultationId)
      .maybeSingle(),
    getSiteSettings(),
  ]);

  if (!booking) {
    console.error(`[stripe] consultation ${consultationId} vanished before confirmation`);
    return;
  }

  const slot = booking.availability_slots as unknown as { starts_at: string } | null;
  const type = booking.consultation_types as unknown as { label: string } | null;

  if (!slot) {
    console.error(`[stripe] consultation ${consultationId} has no slot; skipping email`);
    return;
  }

  const { subject, html } = bookingConfirmationEmail({
    firstName: booking.first_name,
    // Formatted in Sydney time by the same helper the UI uses.
    whenFormatted: formatSlotFull(slot.starts_at),
    typeLabel: type?.label ?? "Consultation",
    depositCents: booking.deposit_cents,
    address: settings.contentIsPlaceholder ? null : formatAddress(settings),
    openingHours: settings.openingHours,
  });

  await sendOnce({
    entityType: "consultation",
    entityId: consultationId,
    template: "booking_confirmation",
    to: booking.email,
    subject,
    html,
  });
}

async function onPaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const meta = intent.metadata as PaymentMetadata;
  const supabase = createAdminClient();

  // A consultation hold is released on failure so the slot returns to the
  // calendar immediately rather than waiting for the expiry sweep. Orders are
  // left pending: the customer may simply retry with another card, and
  // cancelling their order out from under them would be worse than the wait.
  if (meta.purpose === "consultation" && meta.consultation_id) {
    await supabase
      .from("consultations")
      .update({ status: "cancelled" })
      .eq("id", meta.consultation_id)
      .eq("status", "pending_payment");
  }
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!intentId) return;

  const supabase = createAdminClient();

  // Only full refunds flip the order; a partial refund leaves it paid, because
  // the goods still shipped and the record should reflect that.
  if (charge.amount_refunded < charge.amount) return;

  // Conditional on the states a refund can legitimately follow, matching the
  // success path above. The unconditional update this replaced let a late or
  // out-of-order event overwrite a terminal status — a cancelled order could be
  // moved to 'refunded', misreporting what happened to the money.
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", intentId)
    .in("status", ["paid", "fulfilled"])
    .select("id");

  if (error) throw new Error(`refund update failed for ${intentId}: ${error.message}`);
  if (updated && updated.length > 0) return;

  // Nothing moved. Three possibilities, and only one is a problem — so
  // establish which before logging, otherwise every consultation-deposit refund
  // raises a false alarm.
  const { data: existing } = await supabase
    .from("orders")
    .select("status")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  // Not an order at all: a consultation deposit, or a charge created outside
  // this application. `consultation_status` has no 'refunded' member, so there
  // is deliberately nothing to update there — a booking is cancelled through
  // its own flow.
  if (!existing) return;

  // Already refunded: a replay of an event we handled. Expected, not notable.
  if (existing.status === "refunded") return;

  // A genuine anomaly — the money came back but the order was never in a state
  // a refund follows. Most likely Stripe delivered charge.refunded before
  // payment_intent.succeeded. Reported rather than forced, because guessing at
  // the terminal state is how a record stops matching the money.
  console.error(
    `[stripe] refund for ${intentId} left order in '${existing.status}', not 'refunded'. ` +
      `A refund arrived for an order that was never marked paid — check event ordering.`
  );
}
