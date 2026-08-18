import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pill } from "@/components/admin/ui";

/**
 * The desk.
 *
 * A landing page that answers "what needs my attention" rather than showing
 * decorative totals. Drafts and pending testimonials are actionable; the
 * placeholder-content warning is the most important thing on the page, because
 * the site currently ships invented prices and a fabricated press quote and
 * nobody wants to discover that from a customer.
 */
export default async function DeskPage() {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const [gowns, faqs, testimonials, journal, settings] = await Promise.all([
    db.from("products").select("status", { count: "exact" }),
    db.from("faqs").select("is_published", { count: "exact" }),
    db.from("testimonials").select("status", { count: "exact" }),
    db.from("journal_posts").select("published_at"),
    db.from("site_settings").select("content_is_placeholder").maybeSingle(),
  ]);

  const gownRows = (gowns.data ?? []) as { status: string }[];
  const published = gownRows.filter((r) => r.status === "published").length;
  const drafts = gownRows.filter((r) => r.status === "draft").length;

  const faqRows = (faqs.data ?? []) as { is_published: boolean }[];
  const testimonialRows = (testimonials.data ?? []) as { status: string }[];
  const pending = testimonialRows.filter((r) => r.status === "pending").length;

  const journalRows = (journal.data ?? []) as { published_at: string | null }[];
  const journalLive = journalRows.filter(
    (r) => r.published_at !== null && new Date(r.published_at) <= new Date()
  ).length;
  const journalDrafts = journalRows.filter((r) => r.published_at === null).length;

  const placeholder = settings.data?.content_is_placeholder ?? true;

  return (
    <>
      <p className="eyebrow text-dusty-text">Signed in</p>
      <h1 className="font-display mt-2 text-4xl font-light">
        {admin.firstName ? `Good day, ${admin.firstName}` : "The atelier desk"}
      </h1>

      {placeholder && (
        <div className="border-gold bg-gold-tint mt-8 border-l-2 p-5">
          <p className="eyebrow text-gold-text">Before launch</p>
          <p className="mt-2 max-w-[70ch] text-sm">
            This site is still marked as carrying placeholder content — invented prices, example
            testimonials and unconfirmed studio details. Work through the real values, then turn
            the flag off in{" "}
            <Link href="/admin/settings" className="underline underline-offset-4">
              Studio
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          href="/admin/products"
          label="Gowns"
          value={`${published} live`}
          detail={drafts > 0 ? `${drafts} in draft` : "No drafts"}
          flag={drafts > 0}
        />
        <Card
          href="/admin/journal"
          label="Journal"
          value={`${journalLive} live`}
          detail={journalDrafts > 0 ? `${journalDrafts} in draft` : "No drafts"}
          flag={journalDrafts > 0}
        />
        <Card
          href="/admin/faqs"
          label="FAQs"
          value={`${faqRows.filter((r) => r.is_published).length} live`}
          detail={`${faqRows.length} total`}
        />
        <Card
          href="/admin/testimonials"
          label="Testimonials"
          value={`${testimonialRows.filter((r) => r.status === "approved").length} live`}
          detail={pending > 0 ? `${pending} awaiting review` : "Nothing waiting"}
          flag={pending > 0}
        />
        <Card
          href="/admin/settings"
          label="Studio"
          value={placeholder ? "Placeholder" : "Confirmed"}
          detail="Address, phone, hours"
          flag={placeholder}
        />
      </div>

      <div className="border-rule mt-12 border-t pt-6">
        <p className="eyebrow text-dusty-text">A note on saving</p>
        <p className="mt-3 max-w-[70ch] text-sm opacity-70">
          Everything you change here is live immediately — on the website and in the phone app,
          which read the same records. A gown saved as a draft is invisible to both until you
          publish it, so drafts are the safe place to work something out.
        </p>
      </div>
    </>
  );
}

function Card({
  href,
  label,
  value,
  detail,
  flag,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  flag?: boolean;
}) {
  return (
    <Link
      href={href}
      className="border-rule hover:border-mocha block border p-5 transition-colors"
    >
      <p className="eyebrow text-dusty-text">{label}</p>
      <p className="font-display mt-3 text-2xl font-light">{value}</p>
      <p className="mt-2 text-xs opacity-60">
        {flag ? <Pill tone="draft">{detail}</Pill> : detail}
      </p>
    </Link>
  );
}
