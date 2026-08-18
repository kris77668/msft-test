import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { ButtonLink } from "@/components/ui/button";
import { createServerSupabase } from "@/lib/supabase/server";
import { linkGuestRecords } from "@/lib/account/link-guest-records";
import { firstRelation } from "@/lib/supabase/embedded";
import { formatMoney } from "@/lib/money";
import { formatSlotFull } from "@/lib/consultation/slots";
import { AccountClient } from "./account-client";

export const metadata: Metadata = {
  title: "Your Account",
  robots: { index: false, follow: true },
};

// A session is per-request by definition.
export const dynamic = "force-dynamic";

/**
 * Account.
 *
 * Orders, appointments, saved pieces and measurements — the same four things
 * the companion app shows, because the two clients share functionality rather
 * than just a database.
 *
 * Everything below reads through RLS with the customer's own session. There is
 * no `where user_id = …` in any of these queries and there must not be: the
 * owner policies ARE the filter, and adding a redundant one in application
 * code teaches the next person that the policy is optional.
 */
export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <Nav />
        <main className="mx-auto w-full max-w-[520px] flex-1 px-5 py-16 md:px-8">
          <Crumb items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
          <h1 className="font-display mt-8 text-4xl font-light">Your atelier</h1>
          <p className="mt-4 text-sm opacity-80">
            Sign in for your orders, saved pieces, measurements and upcoming
            appointments.
          </p>
          <AccountClient signedIn={false} />
        </main>
        <Footer />
      </>
    );
  }

  // Claim any guest orders placed under this address BEFORE the reads below.
  // Ordering is load-bearing: those reads go through RLS, whose owner policy
  // matches on `user_id`, so anything linked after them would stay invisible
  // until the next page load. This is also the only place the linking runs for
  // a password sign-in, which never touches /auth/callback.
  //
  // A no-op for an unverified address and for already-linked rows — see
  // lib/account/link-guest-records.ts.
  await linkGuestRecords(user);

  const [orders, consultations, saved, measurements] = await Promise.all([
    supabase
      .from("orders")
      .select("order_number, status, total_cents, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("consultations")
      .select("status, availability_slots(starts_at), consultation_types(label)")
      .eq("status", "confirmed")
      .limit(5),
    supabase.from("saved_items").select("product_id, products(slug, name, kind)").limit(50),
    supabase
      .from("measurements")
      .select("bust_cm, waist_cm, hip_cm, height_cm, dress_size")
      .maybeSingle(),
  ]);

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[760px] flex-1 px-5 py-12 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Account" }]} />

        <h1 className="font-display mt-8 text-4xl font-light">Your atelier</h1>
        <AccountClient signedIn email={user.email} />

        <Section title="Upcoming appointments">
          {consultations.data?.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {consultations.data.map((c, i) => (
                <li key={i}>
                  {typeLabel(c.consultation_types)} —{" "}
                  {formatSydney(startsAt(c.availability_slots))}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm opacity-75">
              <p>No appointments booked.</p>
              <ButtonLink href="/consultation" variant="secondary" className="mt-4">
                Book a consultation
              </ButtonLink>
            </div>
          )}
        </Section>

        <Section title="Measurements">
          {measurements.data ? (
            <dl className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <Figure label="Bust" value={measurements.data.bust_cm} />
              <Figure label="Waist" value={measurements.data.waist_cm} />
              <Figure label="Hip" value={measurements.data.hip_cm} />
              <Figure label="Height" value={measurements.data.height_cm} />
            </dl>
          ) : (
            <p className="text-sm opacity-75">
              Add your measurements in the app and we&apos;ll have them ready for
              your next fitting.
            </p>
          )}
        </Section>

        <Section title="Saved pieces">
          {saved.data?.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {saved.data.map((s) => {
                const product = firstRelation(s.products);
                if (!product) return null;
                // A saved piece can outlive its visibility: unpublish it and
                // RLS hides the join, so `products` comes back null. Skipped
                // rather than rendered as a dead link.
                const href =
                  product.kind === "bespoke"
                    ? `/bespoke/${product.slug}`
                    : `/product/${product.slug}`;
                return (
                  <li key={s.product_id}>
                    <a href={href} className="underline-offset-4 hover:underline">
                      {product.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm opacity-75">Nothing saved yet.</p>
          )}
        </Section>

        <Section title="Order history">
          {orders.data?.length ? (
            <ul className="flex flex-col gap-3 text-sm">
              {orders.data.map((o) => (
                <li key={o.order_number} className="flex justify-between gap-4">
                  <span>
                    {o.order_number}
                    <span className="text-dusty-text ml-2">{o.status}</span>
                  </span>
                  <span>{formatMoney(o.total_cents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm opacity-75">
              No orders yet. Past orders are matched to your account by email
              address — contact us if one is missing.
            </p>
          )}
        </Section>
      </main>

      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-softrule mt-12 border-t pt-8">
      <h2 className="eyebrow text-dusty-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div>
      <dt className="eyebrow text-dusty-text">{label}</dt>
      <dd className="font-display mt-1 text-2xl">{value} cm</dd>
    </div>
  );
}

function typeLabel(types: { label: string } | { label: string }[] | null): string {
  return firstRelation(types)?.label ?? "Consultation";
}

function startsAt(
  slots: { starts_at: string } | { starts_at: string }[] | null
): string | null {
  return firstRelation(slots)?.starts_at ?? null;
}

function formatSydney(iso: string | null): string {
  if (!iso) return "time to be confirmed";
  // Sydney, never the server's zone — the same formatter the consultation UI
  // and confirmation emails use, so a fitting time reads identically everywhere.
  // Guard the null first: formatSlotFull takes a string, and new Date(null)
  // would render 1 Jan 1970 rather than "time to be confirmed".
  return formatSlotFull(iso);
}
