"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { CheckIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { formatSlotFull, formatSlotTime, type SlotDay } from "@/lib/consultation/slots";
import { STRIPE_APPEARANCE } from "@/lib/stripe/appearance";
import { clsx } from "@/lib/clsx";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface ConsultationType {
  key: string;
  label: string;
  description: string;
  deposit_cents: number;
}

/**
 * Four-step booking: type → time → details → deposit.
 *
 * Differences from the prototype, which was a visual shell:
 *
 *  - Step 3 had no validation whatsoever (`canNext` returned `true`) and its six
 *    inputs were uncontrolled, so every keystroke was discarded.
 *  - The deposit step had raw card number/expiry/CVC inputs. Those are deleted;
 *    Stripe's Payment Element handles cards inside its own iframe.
 *  - "$100" was hardcoded in five places. It now comes from the database.
 *  - Every slot was always shown as free. Availability is real, and holding a
 *    slot can fail with a 409 if someone books it first.
 */
export function BookingWizard({
  days,
  types,
}: {
  days: SlotDay[];
  types: ConsultationType[];
}) {
  const [step, setStep] = useState(0);
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? "bridal");
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [details, setDetails] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    eventDate: "",
    notes: "",
  });

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [depositCents, setDepositCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const selectedDay = days.find((d) => d.dateKey === dateKey);
  const selectedSlot = selectedDay?.slots.find((s) => s.slotId === slotId);
  const selectedType = types.find((t) => t.key === typeKey);

  const detailsValid =
    details.firstName.trim().length >= 1 &&
    details.lastName.trim().length >= 1 &&
    /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(details.email) &&
    details.phone.replace(/\D/g, "").length >= 8;

  async function hold() {
    if (!slotId) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/consultation/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, typeKey, ...details }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
        // A 409 means the slot went while they were filling the form. Send them
        // back to pick another rather than leaving them stuck.
        if (res.status === 409) {
          setSlotId(null);
          setStep(1);
        }
        return;
      }

      if (body.free) {
        setDone(true);
        return;
      }

      // Guard the step change on actually having a client secret. Advancing
      // without one lands on step 3, which renders nothing and hides the back
      // button — a dead end with no way out but a reload.
      if (!body.clientSecret) {
        setError("We couldn't start the deposit. Please try again.");
        return;
      }

      setClientSecret(body.clientSecret);
      setConfirmationToken(body.confirmationToken ?? null);
      setDepositCents(body.depositCents);
      setStep(3);
    } catch {
      // Without this, a rejected fetch escaped and `setBusy(false)` never ran —
      // the button stayed disabled on "Holding your time…" indefinitely.
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="border-rule bg-cream mt-12 border p-8 text-center md:p-12">
        <span className="border-gold text-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full border">
          <CheckIcon size={24} />
        </span>
        <h2 className="font-display mt-6 text-3xl font-light">Appointment confirmed</h2>
        {selectedSlot && (
          <p className="mt-3 text-sm">{formatSlotFull(selectedSlot.startsAt)}</p>
        )}
        <p className="text-dusty-text mt-1 text-sm">{selectedType?.label}</p>
        <p className="mt-5 text-sm opacity-80">
          A confirmation is on its way to {details.email}, with the studio address
          and what to bring.
        </p>
      </div>
    );
  }

  // No active consultation types means there is nothing bookable, and the
  // wizard cannot recover: `typeKey` would fall back to a "bridal" row that
  // does not exist, the customer would fill in three steps, and /hold would
  // reject the whole thing with "Unknown consultation type" at the deposit.
  // Failing here costs one admin toggle; failing there costs the enquiry.
  if (types.length === 0) {
    return (
      <div className="border-rule bg-cream mt-10 border p-8 text-center md:p-12">
        <p className="font-display text-2xl leading-tight font-light">
          Online booking is temporarily unavailable
        </p>
        <p className="mx-auto mt-3 max-w-[46ch] text-sm opacity-75">
          Please contact the atelier directly and we will arrange a time with you.
        </p>
        <ButtonLink href="/contact" className="mt-6">
          Contact the Atelier
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <Stepper step={step} />

      <div className="border-rule bg-cream mt-7 border p-6 md:p-8">
        {/* ── Step 0: type ─────────────────────────────────────── */}
        {step === 0 && (
          <fieldset>
            <legend className="font-display mb-5 text-2xl font-light">
              What are we meeting about?
            </legend>
            <div className="flex flex-col gap-3">
              {types.map((type) => (
                <label
                  key={type.key}
                  className={clsx(
                    "flex cursor-pointer gap-3 border p-4 transition-colors",
                    typeKey === type.key ? "border-mocha" : "border-rule hover:border-dusty"
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    checked={typeKey === type.key}
                    onChange={() => setTypeKey(type.key)}
                    className="accent-mocha mt-1"
                  />
                  <span>
                    <span className="font-display block text-lg font-light">{type.label}</span>
                    <span className="text-sm opacity-75">{type.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* ── Step 1: date and time ────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="font-display text-2xl font-light">Choose a time</h2>
            <p className="text-dusty-text mt-1 text-sm">
              Tuesday–Saturday · appointments run one hour · Sydney time
            </p>

            {days.length === 0 ? (
              <p className="mt-6 text-sm opacity-75">
                No times are currently available. Please contact us directly.
              </p>
            ) : (
              <>
                <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {days.slice(0, 21).map((day) => (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        setDateKey(day.dateKey);
                        setSlotId(null);
                      }}
                      className={clsx(
                        "flex min-h-16 flex-col items-center justify-center border py-2 transition-colors",
                        dateKey === day.dateKey
                          ? "border-mocha bg-mocha text-cream"
                          : "border-rule hover:border-mocha"
                      )}
                    >
                      <span className="eyebrow text-[9px]">{day.weekday}</span>
                      <span className="font-display text-lg">{day.dayOfMonth}</span>
                      <span className="text-[10px] opacity-70">{day.month}</span>
                    </button>
                  ))}
                </div>

                {selectedDay && (
                  <div className="mt-6">
                    <p className="eyebrow text-dusty-text mb-3">Available times</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedDay.slots.map((slot) => (
                        <button
                          key={slot.slotId}
                          type="button"
                          onClick={() => setSlotId(slot.slotId)}
                          className={clsx(
                            "min-h-11 border px-4 text-sm transition-colors",
                            slotId === slot.slotId
                              ? "border-mocha bg-mocha text-cream"
                              : "border-rule hover:border-mocha"
                          )}
                        >
                          {formatSlotTime(slot.startsAt)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 2: details ──────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="font-display text-2xl font-light">Your details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                required
                value={details.firstName}
                onChange={(e) => setDetails({ ...details, firstName: e.target.value })}
              />
              <Field
                label="Last name"
                required
                value={details.lastName}
                onChange={(e) => setDetails({ ...details, lastName: e.target.value })}
              />
              <Field
                label="Email"
                type="email"
                required
                className="sm:col-span-2"
                value={details.email}
                onChange={(e) => setDetails({ ...details, email: e.target.value })}
              />
              <Field
                label="Phone"
                type="tel"
                required
                className="sm:col-span-2"
                value={details.phone}
                onChange={(e) => setDetails({ ...details, phone: e.target.value })}
              />
              <Field
                label="Wedding or event date"
                type="date"
                className="sm:col-span-2"
                hint="If you know it — it helps us plan the timeline."
                value={details.eventDate}
                onChange={(e) => setDetails({ ...details, eventDate: e.target.value })}
              />
              <TextAreaField
                label="Anything you'd like us to know"
                className="sm:col-span-2"
                placeholder="Mood, inspiration, must-haves…"
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: deposit ──────────────────────────────────── */}
        {step === 3 && clientSecret && (
          <div>
            <h2 className="font-display text-2xl font-light">Secure your appointment</h2>

            <div className="bg-paper mt-5 p-4 text-sm">
              {selectedSlot && <p>{formatSlotFull(selectedSlot.startsAt)}</p>}
              <p className="text-dusty-text mt-1">{selectedType?.label}</p>
              <p className="font-display mt-3 text-2xl">{formatMoney(depositCents)}</p>
              <p className="text-dusty-text mt-1 text-xs">
                Fully credited toward your gown.
              </p>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: STRIPE_APPEARANCE,
              }}
            >
              <DepositStep
                depositCents={depositCents}
                confirmationToken={confirmationToken}
              />
            </Elements>

            {/* PLACEHOLDER — refund and cancellation terms must be written and
                reviewed by a lawyer before launch. Do not invent wording here. */}
            <p className="text-dusty-text mt-4 text-xs">
              [Deposit and cancellation policy — to be confirmed]
            </p>
          </div>
        )}

        {error && (
          <Notice tone="error" size="sm" className="mt-5">
            {error}
          </Notice>
        )}

        {/* Navigation — hidden on the payment step, which has its own button. */}
        {step < 3 && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className={clsx("eyebrow text-dusty-text flex min-h-11 items-center", step === 0 && "invisible")}
            >
              ← Back
            </button>

            <Button
              variant="bespoke"
              disabled={
                busy ||
                (step === 1 && !slotId) ||
                (step === 2 && !detailsValid)
              }
              onClick={() => (step === 2 ? hold() : setStep((s) => s + 1))}
            >
              {busy ? "Holding your time…" : step === 2 ? "Continue to deposit" : "Continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DepositStep({
  depositCents,
  confirmationToken,
}: {
  depositCents: number;
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

    // The token authenticates the customer to their own booking on the
    // confirmation page.
    const returnUrl = new URL("/consultation/confirmed", window.location.origin);
    if (confirmationToken) returnUrl.searchParams.set("t", confirmationToken);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl.toString() },
    });

    // Set the error ONLY when Stripe reported one. Unconditionally, a customer
    // whose deposit had just succeeded saw "Payment could not be completed."
    // during the redirect window — and was left staring at it if the redirect
    // was slow.
    setBusy(false);
    if (stripeError) {
      setError(stripeError.message ?? "Payment could not be completed.");
    }
  }

  return (
    <form onSubmit={pay} className="mt-5">
      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <Notice tone="error" size="sm" className="mt-4">
          {error}
        </Notice>
      )}

      <Button type="submit" variant="bespoke" size="lg" fullWidth disabled={!stripe || busy} className="mt-6">
        {busy ? "Processing…" : `Pay ${formatMoney(depositCents)} deposit`}
      </Button>
    </form>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Type", "Date & time", "Details", "Deposit"];

  return (
    <ol className="flex items-center justify-center gap-2 md:gap-4">
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-2 md:gap-4">
          <span
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-full border text-xs",
              i < step && "border-mocha bg-mocha text-cream",
              i === step && "border-mocha",
              i > step && "border-rule text-dusty-text"
            )}
            aria-current={i === step ? "step" : undefined}
          >
            {i < step ? <CheckIcon size={14} /> : i + 1}
          </span>
          <span className={clsx("eyebrow hidden md:inline", i > step && "text-dusty-text")}>
            {label}
          </span>
          {i < labels.length - 1 && <span className="bg-rule h-px w-4 md:w-8" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
