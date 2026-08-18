"use client";

import { useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useCart } from "@/lib/cart/store";
import { formatMoney } from "@/lib/money";
import { STRIPE_APPEARANCE } from "@/lib/stripe/appearance";

/**
 * Checkout.
 *
 * Two steps: details, then payment. The Payment Element is embedded rather than
 * using Stripe's hosted page, so the atelier's design survives — card fields
 * still live inside Stripe's iframe, so card data never touches this origin
 * (PCI SAQ-A).
 *
 * The prototype had twelve uncontrolled inputs, no validation, and a "Pay" button
 * that merely navigated — you could complete an order with an entirely blank
 * form. Everything here is controlled, required, and the amount is set by the
 * server.
 */

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Customer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  state: string;
  postcode: string;
  marketingOptIn: boolean;
}

const EMPTY: Customer = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  suburb: "",
  state: "NSW",
  postcode: "",
  // Unticked by default. A pre-ticked marketing box is not valid consent under
  // the Spam Act 2003; the prototype shipped it `defaultChecked`.
  marketingOptIn: false,
};

export default function CheckoutPage() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const removeLine = useCart((s) => s.remove);

  const [customer, setCustomer] = useState<Customer>(EMPTY);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from `error` because removing unavailable lines can empty the
  // bag, which switches this component to the empty-state branch below — and a
  // message living in that branch's subtree would vanish with it, leaving the
  // customer with no explanation for why their gown disappeared.
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Identifies this checkout attempt so a retry cannot create a second order.
   *
   * Minted once per mount and deliberately NOT regenerated when the bag
   * changes — the server folds the priced cart into its own key, so an edited
   * bag already becomes a new attempt. Regenerating here as well would defeat
   * the whole mechanism on exactly the retry it exists to catch.
   */
  const attemptKeyRef = useRef<string | null>(null);
  const attemptKey = (attemptKeyRef.current ??= crypto.randomUUID().replace(/-/g, ""));

  const set = <K extends keyof Customer>(key: K, value: Customer[K]) =>
    setCustomer((c) => ({ ...c, [key]: value }));

  async function startPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attemptKey,
        },
        body: JSON.stringify({ lines, customer }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 409: something was archived or unpublished while they were filling in
        // the form. Drop those lines so the bag matches what can actually be
        // bought, and say so — the server refuses to quietly charge for a
        // subset.
        const unavailable: string[] = Array.isArray(body.unavailableLineIds)
          ? body.unavailableLineIds
          : [];

        if (unavailable.length > 0) {
          unavailable.forEach(removeLine);
          setNotice(
            unavailable.length === 1
              ? "One piece in your bag is no longer available and has been removed. Please review your bag and try again."
              : `${unavailable.length} pieces in your bag are no longer available and have been removed. Please review your bag and try again.`
          );
          return;
        }

        // The previous attempt was abandoned server-side, so its key is spent.
        // Mint a fresh one or every subsequent try repeats the same 409.
        if (res.status === 409) {
          attemptKeyRef.current = null;
        }

        setError(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      setClientSecret(body.clientSecret);
      setConfirmationToken(body.confirmationToken ?? null);
      setTotalCents(body.totalCents);
    } catch {
      // A rejected fetch (offline, DNS, aborted) used to escape this function,
      // so `setBusy(false)` never ran and the button stayed disabled on
      // "Preparing…" until the customer reloaded the page.
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (hydrated && lines.length === 0 && !clientSecret) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-light">Your bag is empty</h1>
        {notice && (
          <Notice className="mt-6 text-left" tone="error">
            {notice}
          </Notice>
        )}
        <Link href="/shop" className="eyebrow bg-mocha text-cream mt-8 inline-block px-8 py-4">
          Browse evening wear
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-5 py-12 md:px-8">
      <Link href="/cart" className="eyebrow text-dusty-text">
        ← Back to bag
      </Link>
      <h1 className="font-display mt-4 text-4xl font-light">Checkout</h1>

      {!clientSecret ? (
        <form onSubmit={startPayment} className="mt-8 flex flex-col gap-4">
          <Field
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={customer.email}
            onChange={(e) => set("email", e.target.value)}
            hint="Your order confirmation is sent here."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              required
              autoComplete="given-name"
              value={customer.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
            <Field
              label="Last name"
              required
              autoComplete="family-name"
              value={customer.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </div>

          <Field
            label="Phone"
            type="tel"
            autoComplete="tel"
            value={customer.phone}
            onChange={(e) => set("phone", e.target.value)}
          />

          <Field
            label="Street address"
            required
            autoComplete="address-line1"
            value={customer.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
          <Field
            label="Apartment, suite (optional)"
            autoComplete="address-line2"
            value={customer.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Suburb"
              required
              autoComplete="address-level2"
              value={customer.suburb}
              onChange={(e) => set("suburb", e.target.value)}
            />
            <Field
              label="State"
              required
              autoComplete="address-level1"
              value={customer.state}
              onChange={(e) => set("state", e.target.value)}
            />
            <Field
              label="Postcode"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              value={customer.postcode}
              onChange={(e) => set("postcode", e.target.value)}
            />
          </div>

          <label className="mt-1 flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={customer.marketingOptIn}
              onChange={(e) => set("marketingOptIn", e.target.checked)}
              className="border-rule accent-mocha mt-0.5 h-4 w-4 rounded-none border"
            />
            <span className="opacity-80">Email me with news and new arrivals</span>
          </label>

          <p className="text-dusty-text text-xs">
            We ship within Australia only. Delivery is free and insured.
          </p>

          {notice && <Notice tone="error">{notice}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" size="lg" fullWidth disabled={busy} className="mt-2">
            {busy ? "Preparing…" : "Continue to payment"}
          </Button>
        </form>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            // Themed to the atelier: square corners, cream surfaces, Jost.
            appearance: STRIPE_APPEARANCE,
          }}
        >
          <PaymentStep totalCents={totalCents} confirmationToken={confirmationToken} />
        </Elements>
      )}
    </main>
  );
}

function PaymentStep({
  totalCents,
  confirmationToken,
}: {
  totalCents: number;
  confirmationToken: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    // The token is what authenticates the customer to their own order on the
    // confirmation page. Stripe appends payment_intent and redirect_status to
    // whatever URL is given here.
    const returnUrl = new URL("/confirmation", window.location.origin);
    if (confirmationToken) returnUrl.searchParams.set("t", confirmationToken);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl.toString() },
    });

    // Reached only when confirmation failed; success navigates away. The error
    // is set ONLY when Stripe actually reported one — the previous unconditional
    // fallback meant that during the redirect window a customer whose payment
    // had just SUCCEEDED was shown "Payment could not be completed."
    //
    // The cart is cleared on the confirmation page, once the order is known to
    // exist, so a failed payment doesn't lose the customer's bag.
    setBusy(false);
    if (stripeError) {
      setError(stripeError.message ?? "Payment could not be completed.");
    }
  }

  return (
    <form onSubmit={pay} className="mt-8">
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}

      <Button type="submit" size="lg" fullWidth disabled={!stripe || busy} className="mt-6">
        {busy ? "Processing…" : `Pay ${formatMoney(totalCents)}`}
      </Button>

      <p className="text-dusty-text mt-4 text-center text-xs">
        Payments are processed by Stripe. Card details never reach our servers.
      </p>
    </form>
  );
}
