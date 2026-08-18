import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { newsletterConfirmEmail, sendTransactional } from "@/lib/email/brevo";
import { allow, allowByIp, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Newsletter subscription — double opt-in.
 *
 * The whole implementation lives here rather than in the server action, so the
 * website form and the mobile app reach the same code. A second copy behind a
 * route handler would drift, and the parts most likely to drift are the ones
 * that must not: the rate limits and the deliberately-uniform responses.
 *
 * Runs with the admin client because the public key has no write policy on
 * `newsletter_subscribers`; letting a client insert directly would make the
 * list enumerable and spammable.
 *
 * Double opt-in rather than a straight insert: the Spam Act 2003 requires
 * consent from the address owner, and anyone can type someone else's address
 * into a box. The row is created as 'pending' and only becomes a marketing
 * contact after the link is clicked.
 */

export const newsletterEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  // Deliberately stricter than the prototype, which accepted anything containing
  // "@" in the footer and used /^[^@]+@[^@]+\.[^@]+$/ on the contact form — a
  // pattern that accepts "a@b .c" (spaces) and rejects nothing much else.
  .regex(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, "Please enter a valid email address");

export type NewsletterOutcome = {
  status: "success" | "error";
  message: string;
  /**
   * For the HTTP caller only. A rate-limited or already-subscribed request is
   * reported to the *user* as success on purpose; this lets the route handler
   * pick a status code without leaking that distinction into the message.
   */
  httpStatus: 200 | 400 | 500;
};

// One acknowledgement for every non-error outcome — new signup, already
// confirmed, and rate-limited alike. It must not distinguish "already a
// confirmed subscriber" from "not yet", or the form becomes an oracle for
// testing who is on the list. Worded so it is truthful in all three cases: a
// new subscriber does have a confirmation waiting; an existing one has nothing
// to do and simply finds no new mail.
const SUBSCRIBE_ACK =
  "Thank you — if you're not already subscribed, please check your inbox to confirm.";
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function subscribe(
  rawEmail: unknown,
  rawSource: unknown
): Promise<NewsletterOutcome> {
  const parsed = newsletterEmailSchema.safeParse(rawEmail);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid email",
      httpStatus: 400,
    };
  }

  const email = parsed.data;
  const source = typeof rawSource === "string" && rawSource ? rawSource : "footer";

  // Two independent limits. The address limit is the one that matters: without
  // it, resubmitting a pending address re-sent the confirmation every time, so
  // anyone could point this endpoint at a victim's inbox and hold it open.
  // Keying on the address means rotating IPs does not help an attacker.
  const [addressOk, ipOk] = await Promise.all([
    allow(`newsletter:address:${email}`, RATE_LIMITS.newsletterAddress),
    allowByIp("newsletter", RATE_LIMITS.newsletterIp),
  ]);

  if (!addressOk || !ipOk) {
    // Deliberately indistinguishable from the already-subscribed and new-signup
    // replies, so the form still cannot be used to probe who is on the list.
    // Note this returns 200, not 429 — a distinct status would restore exactly
    // the signal the uniform message exists to remove.
    return { status: "success", message: SUBSCRIBE_ACK, httpStatus: 200 };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("newsletter_subscribers")
    .select("id, status, confirm_token")
    .eq("email", email)
    .maybeSingle();

  // Already subscribed — acknowledge without revealing anything, and without
  // re-sending. The message is identical to the new-signup and rate-limited
  // replies so the form cannot be used to test whether an address is on the list.
  if (existing?.status === "confirmed") {
    return { status: "success", message: SUBSCRIBE_ACK, httpStatus: 200 };
  }

  let token = existing?.confirm_token ?? null;

  if (!existing) {
    const { data: inserted, error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email, source })
      .select("confirm_token")
      .single();

    if (error) {
      console.error("[newsletter] insert failed:", error.message);
      return { status: "error", message: GENERIC_ERROR, httpStatus: 500 };
    }
    token = inserted.confirm_token;
  }

  if (!token) {
    return { status: "error", message: GENERIC_ERROR, httpStatus: 500 };
  }

  const confirmUrl = `${getEnv().NEXT_PUBLIC_SITE_URL}/newsletter/confirm?token=${token}`;
  const sent = await sendTransactional({
    to: email,
    subject: "Please confirm your subscription",
    html: newsletterConfirmEmail(confirmUrl),
  });

  if (!sent.ok) {
    console.error("[newsletter] send failed:", sent.error);
    return {
      status: "error",
      message: "We couldn't send the confirmation email. Please try again.",
      httpStatus: 500,
    };
  }

  // Same acknowledgement as the already-confirmed and rate-limited paths. A
  // new-signup-specific "almost there" message would reveal that this address
  // was NOT already a confirmed subscriber — the enumeration signal the shared
  // wording exists to remove.
  return {
    status: "success",
    message: SUBSCRIBE_ACK,
    httpStatus: 200,
  };
}
