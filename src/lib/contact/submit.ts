import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactional } from "@/lib/email/brevo";
import { EMAIL, emailBody } from "@/lib/email/tokens";
import { emailShell, escapeHtml } from "@/lib/email/layout";
import { allowByIp, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Contact enquiry.
 *
 * The implementation lives here so the website form action and the mobile
 * app's `POST /api/contact` share one copy. The anti-spam behaviour below is
 * subtle enough that two copies would eventually disagree, and a disagreement
 * is what makes the honeypot detectable.
 *
 * Writes through the admin client because the public key has no insert policy
 * on `contact_messages` — otherwise the form would be a spam sink and the table
 * would be readable by anyone.
 *
 * The prototype's contact form was the only validated thing on the site, but its
 * email pattern accepted `a@b .c` (spaces) and its error copy interpolated the
 * label, producing "Please add a valid your name."
 */

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, "Please enter a valid email address"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 8, "Please enter a valid phone number")
    .optional(),
  eventDate: z.string().optional(),
  collection: z.enum(["Bridal", "Evening", "Bespoke", "Just curious"]),
  message: z.string().trim().min(10, "Please tell us a little more").max(4000),
  // Honeypot: bots fill every field, humans never see this one.
  //
  // Accepts ANY string on purpose. It used to be `.max(0)`, which made a filled
  // honeypot fail validation — so the bot got back a field-level error naming
  // `website`, which is precisely the feedback that teaches it to stop filling
  // that field. It also made the silent-accept branch below unreachable code.
  // Validation must pass so the request can be quietly discarded instead.
  website: z.string().max(200).optional(),
});

export type ContactOutcome = {
  status: "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
  /**
   * For the HTTP caller. Discarded honeypot and rate-limited requests report
   * 200 with the ordinary success message on purpose — a 429 would tell a
   * script it had been detected, which is the one thing this must not do.
   */
  httpStatus: 200 | 400 | 500;
};

/** Identical for a real submission, a bot submission and a throttled one. */
const ACCEPTED = "Thank you — we'll be in touch.";

export async function submitEnquiry(raw: unknown): Promise<ContactOutcome> {
  const parsed = contactSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
      httpStatus: 400,
    };
  }

  const input = parsed.data;

  // Silently accept honeypot submissions so bots don't learn to adapt. Reached
  // now that the schema no longer rejects a filled honeypot outright.
  if (input.website?.trim()) {
    return { status: "success", message: ACCEPTED, httpStatus: 200 };
  }

  // Checked after the honeypot so bot traffic never consumes a real visitor's
  // allowance. Same wording as success: a rate-limit message would tell a
  // script it had been detected.
  if (!(await allowByIp("contact", RATE_LIMITS.contactIp))) {
    return { status: "success", message: ACCEPTED, httpStatus: 200 };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").insert({
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    event_date: input.eventDate || null,
    collection: input.collection,
    message: input.message,
  });

  if (error) {
    console.error("[contact] insert failed:", error.message);
    return {
      status: "error",
      message: "Something went wrong. Please try again, or call us.",
      httpStatus: 500,
    };
  }

  // Acknowledgement to the enquirer. A failure here must not tell them their
  // message was lost — it's already saved and the atelier can see it.
  const sent = await sendTransactional({
    to: input.email,
    subject: "We've received your enquiry",
    html: emailShell({
      heading: `Thank you, ${escapeHtml(input.name.split(" ")[0] || input.name)}`,
      body: `
          <p style="${emailBody};margin:0 0 20px">
            We've received your enquiry and will reply within two business days.
          </p>
          <p style="${emailBody};margin:0;color:${EMAIL.dustyText}">
            If it's about a wedding gown, it's worth booking a consultation — that's
            where every commission begins.
          </p>`,
    }),
  });

  if (!sent.ok) console.error("[contact] acknowledgement email failed:", sent.error);

  return {
    status: "success",
    message: "Thank you — we'll be in touch within two business days.",
    httpStatus: 200,
  };
}
