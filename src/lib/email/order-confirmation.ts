import { EMAIL, emailBody } from "./tokens";
import { emailShell, escapeHtml } from "./layout";
import { formatMoney } from "@/lib/money";

/**
 * Order confirmation.
 *
 * ON THE TAX INVOICE QUESTION — read before "improving" this.
 *
 * AGENTS.md requires order confirmations to be valid AU tax invoices carrying
 * the ABN. A tax invoice is a document with statutory meaning, so this renders
 * the invoice block only when the caller supplies `business` — and the caller
 * supplies it only when the ABN passes the ATO checksum (lib/site/abn.ts), not
 * merely when the field is non-empty. `site_settings.abn` shipped seeded with
 * the truthy placeholder 'ABN TO BE CONFIRMED', which a truthiness check would
 * have printed onto the invoice.
 *
 * With `business` null this is a plain order confirmation that never uses the
 * words "tax invoice".
 *
 * `address` is separately optional: the studio's ABN is confirmed while its
 * address is not, and the ATO requires the supplier's identity and ABN, not a
 * postal address.
 *
 * Pure — no I/O, no secrets — so it can be unit-tested and so the caller
 * decides what the business details are.
 */

export interface OrderConfirmationItem {
  name: string;
  size: string;
  qty: number;
  unitPriceCents: number;
}

export interface InvoiceBusiness {
  legalName: string;
  abn: string;
  address: string | null;
}

export interface OrderConfirmationData {
  orderNumber: string;
  firstName: string;
  items: readonly OrderConfirmationItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  gstCents: number;
  /** Null while the studio's ABN is unconfirmed — see the note above. */
  business: InvoiceBusiness | null;
}

const cell = `font-family:${EMAIL.body};font-size:14px;font-weight:300;padding:8px 0;border-bottom:1px solid rgba(61,46,38,0.1)`;

export function orderConfirmationEmail(data: OrderConfirmationData): {
  subject: string;
  html: string;
} {
  const isInvoice = data.business !== null;

  const rows = data.items
    .map(
      (item) => `
          <tr>
            <td style="${cell};text-align:left">
              ${escapeHtml(item.name)}
              <span style="color:${EMAIL.dustyText}">· Size ${escapeHtml(item.size)} · Qty ${item.qty}</span>
            </td>
            <td style="${cell};text-align:right;white-space:nowrap">
              ${formatMoney(item.unitPriceCents * item.qty)}
            </td>
          </tr>`
    )
    .join("");

  const totals = `
          <tr>
            <td style="${cell};text-align:left;border-bottom:none">Subtotal</td>
            <td style="${cell};text-align:right;border-bottom:none">${formatMoney(data.subtotalCents)}</td>
          </tr>
          <tr>
            <td style="${cell};text-align:left;border-bottom:none">Shipping</td>
            <td style="${cell};text-align:right;border-bottom:none">${
              data.shippingCents === 0 ? "Free" : formatMoney(data.shippingCents)
            }</td>
          </tr>
          <tr>
            <td style="font-family:${EMAIL.display};font-size:18px;padding:12px 0 0;text-align:left">Total paid</td>
            <td style="font-family:${EMAIL.display};font-size:18px;padding:12px 0 0;text-align:right">${formatMoney(
              data.totalCents
            )}</td>
          </tr>
          <tr>
            <td colspan="2" style="${emailBody};font-size:12px;color:${EMAIL.dustyText};padding:4px 0 0;text-align:left">
              Includes ${formatMoney(data.gstCents)} GST
            </td>
          </tr>`;

  const invoiceBlock = data.business
    ? `
        <div style="background:${EMAIL.paper};padding:16px;margin:28px 0 0">
          <p style="${emailBody};font-size:12px;margin:0">
            <strong style="font-weight:400">Tax invoice</strong><br />
            ${escapeHtml(data.business.legalName)}<br />
            ABN ${escapeHtml(data.business.abn)}
            ${data.business.address ? `<br />${escapeHtml(data.business.address)}` : ""}
          </p>
          <p style="${emailBody};font-size:12px;color:${EMAIL.dustyText};margin:8px 0 0">
            Total includes GST of ${formatMoney(data.gstCents)}. Order ${escapeHtml(data.orderNumber)}.
          </p>
        </div>`
    : "";

  const html = emailShell({
    heading: `Thank you, ${escapeHtml(data.firstName)}`,
    body: `
        <p style="${emailBody};margin:0 0 24px">
          We've received your order <strong style="font-weight:400">${escapeHtml(data.orderNumber)}</strong>
          and it's now with the atelier.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
          ${rows}
          ${totals}
        </table>

        ${invoiceBlock}

        <p style="${emailBody};margin:28px 0 0">
          Made-to-order pieces ship within 8–10 weeks. We'll be in touch to confirm
          your measurements before cutting.
        </p>`,
    footnote: isInvoice
      ? undefined
      : "Keep this email as your record of purchase. A formal tax invoice will follow.",
  });

  return {
    subject: `Your Ms Fairy Tale order ${data.orderNumber}`,
    html,
  };
}
