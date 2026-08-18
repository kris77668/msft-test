import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSlotFull } from "@/lib/consultation/slots";
import { formatMoney } from "@/lib/money";
import { getSiteSettings, formatAddress } from "@/lib/site/settings";
import { ConfirmationShell } from "@/components/ui/confirmation-shell";

export const metadata: Metadata = {
  title: "Appointment confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Booking confirmation.
 *
 * Authenticated by `confirmation_token` on the return URL, not by the Stripe
 * `payment_intent` id — see the longer note in app/confirmation/page.tsx. This
 * page exposes a customer's name, email and appointment time, so the thing that
 * unlocks it needs to be a credential that expires.
 *
 * Reads state; the webhook is what confirms. If the browser arrives first, we
 * say so honestly rather than claiming a booking we can't verify.
 */
export default async function ConsultationConfirmedPage(props: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await props.searchParams;

  if (!token) {
    return (
      <Shell heading="Nothing to show here" body="We couldn't find a booking for this link." />
    );
  }

  const supabase = createAdminClient();
  const [{ data: booking }, settings] = await Promise.all([
    supabase
      .from("consultations")
      .select(
        "status, deposit_cents, email, first_name, confirmation_expires_at, availability_slots(starts_at), consultation_types(label)"
      )
      .eq("confirmation_token", token)
      .maybeSingle(),
    getSiteSettings(),
  ]);

  if (!booking) {
    return (
      <Shell
        heading="We couldn't find that booking"
        body="If you were charged, contact us and we'll sort it out immediately."
      />
    );
  }

  if (new Date(booking.confirmation_expires_at) <= new Date()) {
    return (
      <Shell
        heading="This link has expired"
        body="Contact us and we'll resend your appointment details."
      />
    );
  }

  const confirmed = booking.status === "confirmed";
  // The deposit was taken but the hold had already lapsed — the slot may have
  // gone to someone else. The webhook logs this for manual refund; the customer
  // must not be left refreshing a page that will never say "confirmed".
  const stuck = booking.status === "expired" || booking.status === "cancelled";

  const slot = booking.availability_slots as unknown as { starts_at: string } | null;
  const type = booking.consultation_types as unknown as { label: string } | null;
  const address = formatAddress(settings);

  if (stuck) {
    return (
      <Shell
        heading="We need to check something"
        body="Your booking didn't complete as expected. If your deposit was charged, please contact us — we'll either secure your appointment or refund you straight away. Don't book again just yet."
      />
    );
  }

  return (
    <Shell
      heading={confirmed ? "Appointment confirmed" : "Confirming your booking"}
      body={
        confirmed
          ? `Thank you, ${booking.first_name}. A confirmation is on its way to ${booking.email}.`
          : "Your deposit is being confirmed. This usually takes a few seconds — refresh in a moment."
      }
    >
      {confirmed && (
        <div className="border-rule mt-8 border-t pt-6 text-left text-sm">
          {slot && <p className="font-display text-xl">{formatSlotFull(slot.starts_at)}</p>}
          <p className="text-dusty-text mt-1">{type?.label}</p>

          <p className="mt-5">
            {formatMoney(booking.deposit_cents)} deposit received — fully credited
            toward your gown.
          </p>

          <div className="bg-paper mt-6 p-4">
            <p className="eyebrow text-dusty-text">Where to find us</p>
            <p className="mt-2">
              {address ?? "Studio address to be confirmed — we'll include it in your email."}
            </p>
            {settings.openingHours && (
              <p className="text-dusty-text mt-1 text-xs">{settings.openingHours}</p>
            )}
          </div>

          <p className="mt-6 opacity-80">
            Bring anything that helps us understand what you&apos;re imagining —
            images, a keepsake, a fabric you love. There&apos;s no need to prepare
            beyond that.
          </p>
        </div>
      )}

      <Link href="/" className="eyebrow bg-mocha text-cream mt-10 inline-block px-8 py-4">
        Return home
      </Link>
    </Shell>
  );
}

/** Thin wrapper adding this page's body-as-prop convention to the shared shell. */
function Shell({
  heading,
  body,
  children,
}: {
  heading: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <ConfirmationShell heading={heading}>
      <p className="mt-4 text-sm opacity-80">{body}</p>
      {children}
    </ConfirmationShell>
  );
}
