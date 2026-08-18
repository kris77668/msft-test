import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, gstComponent } from "@/lib/money";
import { ConfirmationShell } from "@/components/ui/confirmation-shell";
import { ClearCartOnMount } from "./clear-cart";

export const metadata: Metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Order confirmation.
 *
 * AUTHENTICATION — this page reads a guest's order with the admin client, so
 * what identifies the caller matters.
 *
 * It is the `confirmation_token`: a 244-bit single-purpose value the database
 * generates per order, handed to the browser by /api/checkout and carried here
 * on the Stripe return URL as `?t=`. It expires (`confirmation_expires_at`,
 * 30 days), and the expiry is enforced in the query below.
 *
 * It used to be the `payment_intent` id, which Stripe appends to the return
 * URL. That was never designed as a credential: it is not expiring, not
 * single-purpose, and it leaks anywhere a URL leaks — history, a shared link,
 * a Referer header, analytics, server logs. The token column existed the whole
 * time and nothing read it. `Referrer-Policy: strict-origin-when-cross-origin`
 * in next.config.ts closes the referrer half of the same problem.
 *
 * This page READS state; it never marks anything paid — that is the webhook's
 * job, and the webhook may not have landed yet when the browser arrives. When
 * that happens we show an honest "confirming" state rather than claiming a
 * success we can't verify.
 */
export default async function ConfirmationPage(props: {
  searchParams: Promise<{ t?: string; redirect_status?: string }>;
}) {
  const { t: token, redirect_status: status } = await props.searchParams;

  if (!token) {
    return (
      <ConfirmationShell heading="Nothing to show here">
        <p className="mt-4 text-sm opacity-80">
          We couldn&apos;t find an order for this link.
        </p>
      </ConfirmationShell>
    );
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_number, status, total_cents, gst_cents, email, confirmation_expires_at, order_items(product_name, size, qty, unit_price_cents)"
    )
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!order) {
    return (
      <ConfirmationShell heading="We couldn't find that order">
        <p className="mt-4 text-sm opacity-80">
          If you were charged, contact us and we&apos;ll sort it out immediately.
        </p>
      </ConfirmationShell>
    );
  }

  // Enforced here rather than in the query so an expired link gets its own
  // message. A guessed token is not a concern at 244 bits of entropy.
  if (new Date(order.confirmation_expires_at) <= new Date()) {
    return (
      <ConfirmationShell heading="This link has expired">
        <p className="mt-4 text-sm opacity-80">
          Order confirmation links are valid for 30 days. Contact us and we&apos;ll
          send your order details again.
        </p>
      </ConfirmationShell>
    );
  }

  const paid = order.status === "paid";
  const failed = status === "failed";
  // Paid at Stripe but the order was cancelled or never reconciled. Saying
  // "confirming, refresh in a moment" here would be a lie that never resolves.
  const stuck = !paid && (order.status === "cancelled" || order.status === "refunded");

  return (
    <ConfirmationShell
      heading={
        paid
          ? "Thank you"
          : failed
            ? "Payment unsuccessful"
            : stuck
              ? "We need to check something"
              : "Confirming your order"
      }
    >
      {/* Only clear once we know an order exists — a failed payment keeps the bag. */}
      {paid && <ClearCartOnMount />}

      {paid ? (
        <p className="mt-4 text-sm opacity-80">
          Order <strong className="font-normal">{order.order_number}</strong>. A confirmation
          is on its way to {order.email}.
        </p>
      ) : failed ? (
        <p className="mt-4 text-sm opacity-80">
          Your payment didn&apos;t go through and you have not been charged. Your bag is still saved.
        </p>
      ) : stuck ? (
        <p className="mt-4 text-sm opacity-80">
          Order <strong className="font-normal">{order.order_number}</strong> didn&apos;t complete
          as expected. If you were charged, contact us and we&apos;ll resolve it straight
          away — please don&apos;t pay again.
        </p>
      ) : (
        <p className="mt-4 text-sm opacity-80">
          Your payment is being confirmed. This usually takes a few seconds — refresh in a moment.
        </p>
      )}

      {paid && (
        <div className="border-rule mt-10 border-t pt-6 text-left">
          <ul className="flex flex-col gap-3 text-sm">
            {(order.order_items ?? []).map((item, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span>
                  {item.product_name}
                  <span className="text-dusty-text"> · Size {item.size} · Qty {item.qty}</span>
                </span>
                <span className="whitespace-nowrap">
                  {formatMoney(item.unit_price_cents * item.qty)}
                </span>
              </li>
            ))}
          </ul>

          <div className="border-rule mt-5 flex justify-between border-t pt-4">
            <span className="font-display text-lg">Total paid</span>
            <span className="font-display text-lg">{formatMoney(order.total_cents)}</span>
          </div>
          <p className="text-dusty-text mt-1 text-xs">
            Includes {formatMoney(order.gst_cents ?? gstComponent(order.total_cents))} GST
          </p>

          <p className="mt-6 text-sm opacity-75">
            Made-to-order pieces ship within 8–10 weeks. We&apos;ll be in touch to confirm
            your measurements before cutting.
          </p>
        </div>
      )}

      <Link href="/" className="eyebrow bg-mocha text-cream mt-10 inline-block px-8 py-4">
        Return home
      </Link>
    </ConfirmationShell>
  );
}
