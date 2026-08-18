import "server-only";
import { getEnv } from "@/lib/env";
import { emailBody, emailButton } from "./tokens";
import { emailShell, escapeHtml } from "./layout";

/**
 * Brevo — marketing contacts and transactional email.
 *
 * Both jobs run through one provider on the free plan, but they are kept behind
 * separate functions and separate sending subdomains:
 *
 *   news.msfairytale.com.au   campaigns, newsletters
 *   mail.msfairytale.com.au   order and booking confirmations
 *
 * Sender reputation is the reason. Marketing unsubscribes and spam complaints
 * degrade the sending domain, and the first thing to land in junk is the order
 * confirmation — the email a customer actually needs. Separate subdomains with
 * separate DKIM keys isolate the two reputations.
 *
 * The whole surface is this file so swapping to Klaviyo later touches one module.
 */

const API = "https://api.brevo.com/v3";

const SENDERS = {
  transactional: { name: "Ms Fairy Tale", email: "hello@mail.msfairytale.com.au" },
  marketing: { name: "Ms Fairy Tale", email: "atelier@news.msfairytale.com.au" },
} as const;

/**
 * Hard ceiling on a single Brevo request.
 *
 * The confirmation send runs inside the Stripe webhook, which the platform
 * kills at ~10s (Netlify Free). A hung provider must resolve as a FAILURE well
 * before that: `sendOnce` releases its emails_sent claim only on an explicit
 * failure, so a process killed mid-send would instead leave the claim held and
 * the email silently lost. Aborting at 8s turns that into a releasable failure
 * with room for the surrounding round trips to still complete under the cap.
 */
const REQUEST_TIMEOUT_MS = 8000;

async function brevo(path: string, body: unknown): Promise<Response> {
  const env = getEnv();

  return fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    // A timeout (or any network error) rejects rather than returning a Response;
    // both public functions below catch that and report { ok: false }.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** Falls back to plain-text-ish stripped HTML for clients that need it. */
  text?: string;
}

/**
 * Transactional send. Callers must guard against duplicates via the
 * `emails_sent` ledger — Stripe retries webhooks, and a retry must not produce
 * a second confirmation email.
 */
export async function sendTransactional({
  to,
  subject,
  html,
  text,
}: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await brevo("/smtp/email", {
      sender: SENDERS.transactional,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    });
  } catch (err) {
    // Timeout or network failure — reported as a failure (not thrown) so the
    // caller's claim-release path runs and a retry can genuinely resend.
    return { ok: false, error: err instanceof Error ? err.message : "Brevo unreachable" };
  }

  if (res.ok) return { ok: true };

  const body = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false, error: body.message ?? `Brevo returned ${res.status}` };
}

/**
 * Adds a CONFIRMED subscriber to the marketing list.
 *
 * Only called after double opt-in. The Spam Act 2003 requires consent, sender
 * identification and a working unsubscribe; a bare email address typed into a
 * box is not consent until the owner confirms it.
 */
export async function addMarketingContact(
  email: string,
  attributes: Record<string, string> = {}
): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await brevo("/contacts", {
      email,
      attributes,
      updateEnabled: true,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Brevo unreachable" };
  }

  // 201 created, 204 updated. 400 with duplicate_parameter means it already
  // exists, which for our purposes is success.
  if (res.ok) return { ok: true };

  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (body.code === "duplicate_parameter") return { ok: true };

  return { ok: false, error: body.message ?? `Brevo returned ${res.status}` };
}

export function newsletterConfirmEmail(confirmUrl: string): SendEmailOptions["html"] {
  return emailShell({
    heading: "One last step",
    body: `
        <p style="${emailBody};margin:0 0 28px">
          Please confirm you'd like to hear from the atelier — new arrivals, private
          trunk shows and the occasional story. A few times a season, never more.
        </p>
        <a href="${escapeHtml(confirmUrl)}" style="${emailButton}">Confirm subscription</a>`,
    footnote:
      "If you didn't ask for this, simply ignore this email — nothing further will be sent.",
  });
}
