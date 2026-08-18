import { EMAIL, emailBody } from "./tokens";
import { emailShell, escapeHtml } from "./layout";
import { formatMoney } from "@/lib/money";

/**
 * Consultation booking confirmation.
 *
 * The appointment time is passed in ALREADY FORMATTED, by
 * `formatSlotFull` from lib/consultation/slots.ts, which renders it in
 * Australia/Sydney with an explicit meridiem. That is deliberate: the whole
 * class of bug this schema was built to avoid is a time rendered in the wrong
 * zone, and the prototype's bare '1:00' strings meant a customer could book
 * what they read as an afternoon appointment and arrive at 1am. This module
 * never touches a Date.
 *
 * Address is optional because the studio address is still unconfirmed; when it
 * is null the email says so rather than inventing one.
 *
 * Pure — no I/O — so it can be unit-tested.
 */

export interface BookingConfirmationData {
  firstName: string;
  /** Pre-formatted in Sydney time, e.g. "Tuesday 21 July 2026, 1:00 pm". */
  whenFormatted: string;
  typeLabel: string;
  depositCents: number;
  address: string | null;
  openingHours: string | null;
}

export function bookingConfirmationEmail(data: BookingConfirmationData): {
  subject: string;
  html: string;
} {
  const whereBlock = data.address
    ? `
        <div style="background:${EMAIL.paper};padding:16px;margin:24px 0 0">
          <p style="${emailBody};font-size:12px;margin:0">
            <strong style="font-weight:400">Where to find us</strong><br />
            ${escapeHtml(data.address)}
            ${
              data.openingHours
                ? `<br /><span style="color:${EMAIL.dustyText}">${escapeHtml(data.openingHours)}</span>`
                : ""
            }
          </p>
        </div>`
    : `
        <p style="${emailBody};font-size:12px;color:${EMAIL.dustyText};margin:24px 0 0">
          We'll send the studio address separately before your appointment.
        </p>`;

  const html = emailShell({
    heading: `Your appointment is confirmed, ${escapeHtml(data.firstName)}`,
    body: `
        <p style="font-family:${EMAIL.display};font-size:22px;font-weight:300;margin:0 0 4px">
          ${escapeHtml(data.whenFormatted)}
        </p>
        <p style="${emailBody};color:${EMAIL.dustyText};margin:0 0 24px">
          ${escapeHtml(data.typeLabel)}
        </p>

        <p style="${emailBody};margin:0">
          ${formatMoney(data.depositCents)} deposit received — fully credited toward your gown.
        </p>

        ${whereBlock}

        <p style="${emailBody};margin:24px 0 0">
          Bring anything that helps us understand what you're imagining — images,
          a keepsake, a fabric you love. There's no need to prepare beyond that.
        </p>`,
    footnote: "Need to change your appointment? Reply to this email and we'll rearrange it.",
  });

  return {
    subject: `Your Ms Fairy Tale appointment — ${data.whenFormatted}`,
    html,
  };
}
