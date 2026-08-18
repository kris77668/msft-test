import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PG_UNIQUE_VIOLATION } from "@/lib/supabase/errors";
import { sendTransactional } from "./brevo";
import { htmlToText } from "./layout";

/**
 * Send an email at most once per (entity, template).
 *
 * The `emails_sent` table has existed since the commerce migration and, until
 * now, nothing wrote to it. This is the guard it was built for: Stripe retries
 * webhooks aggressively, and two deliveries of the same event must not produce
 * two order confirmations.
 *
 * ORDERING — claim first, then send:
 *
 *   The unique constraint on (entity_type, entity_id, template) is the only
 *   idempotency primitive available, and it can only be taken by writing. So
 *   the row is inserted BEFORE the send. If the insert conflicts, another
 *   delivery already owns this message and we do nothing.
 *
 *   The trade-off is at-most-once rather than at-least-once: if the process
 *   dies between the claim and the send, the email is lost. Sending first and
 *   claiming after would invert that into at-least-once, and a customer
 *   receiving two "your gown is confirmed" emails — or worse, two tax invoices
 *   for one payment — is the more damaging failure. A send that FAILS (as
 *   opposed to never running) releases the claim below, so the ordinary error
 *   path still retries.
 *
 * Never throws. A confirmation email failing must not fail the webhook and send
 * Stripe into a retry loop over an order that is already paid and recorded.
 */

export type EmailEntity = "order" | "consultation" | "contact";

export interface SendOnceOptions {
  entityType: EmailEntity;
  entityId: string;
  /** Stable identifier for the message kind, e.g. 'order_confirmation'. */
  template: string;
  to: string;
  subject: string;
  html: string;
}

export type SendOnceResult =
  | { status: "sent" }
  | { status: "duplicate" }
  | { status: "failed"; error: string };

export async function sendOnce({
  entityType,
  entityId,
  template,
  to,
  subject,
  html,
}: SendOnceOptions): Promise<SendOnceResult> {
  const supabase = createAdminClient();

  const { error: claimError } = await supabase.from("emails_sent").insert({
    entity_type: entityType,
    entity_id: entityId,
    template,
    recipient: to,
  });

  if (claimError) {
    // 23505 = unique_violation: this message was already sent (or is being sent
    // by a concurrent delivery). The expected, healthy path on a webhook retry.
    if (claimError.code === PG_UNIQUE_VIOLATION) return { status: "duplicate" };

    // Could not claim. Do NOT send — an unrecorded send is one we might repeat.
    console.error(`[email] could not claim ${template} for ${entityType} ${entityId}:`, claimError.message);
    return { status: "failed", error: claimError.message };
  }

  const sent = await sendTransactional({ to, subject, html, text: htmlToText(html) });

  if (!sent.ok) {
    // Release the claim so a later retry can genuinely resend, rather than
    // being swallowed as a duplicate and leaving the customer with nothing.
    await supabase
      .from("emails_sent")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("template", template);

    console.error(`[email] ${template} to ${to} failed:`, sent.error);
    return { status: "failed", error: sent.error ?? "unknown" };
  }

  return { status: "sent" };
}
