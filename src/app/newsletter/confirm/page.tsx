import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMarketingContact } from "@/lib/email/brevo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

type Result = "confirmed" | "already" | "invalid";

const COPY: Record<Result, { heading: string; body: string }> = {
  confirmed: {
    heading: "You're on the list",
    body: "Thank you — we'll be in touch when there's something worth sharing.",
  },
  already: {
    heading: "Already confirmed",
    body: "You're subscribed. Nothing more to do.",
  },
  invalid: {
    heading: "This link has expired",
    body: "The confirmation link is no longer valid. Please subscribe again and we'll send a fresh one.",
  },
};

/**
 * Double opt-in landing page.
 *
 * Consuming the token is what turns a typed-in address into consent under the
 * Spam Act, so it must be a deliberate human action — NOT a bare page load.
 * Email-security scanners (Microsoft SafeLinks, Mimecast, Barracuda) and some
 * clients GET-prefetch every link in a message; if that GET confirmed the
 * subscription, a scanner would opt someone in without their ever clicking, and
 * the "consent" on record would be a machine's. So the emailed link lands on a
 * confirm BUTTON here, and only the resulting POST (the `confirmAction` server
 * action) writes. A scanner's GET renders the button and changes nothing.
 *
 * The server action works without client JavaScript — Next progressively
 * enhances `<form action={serverAction}>` — so the flow keeps parity with the
 * rest of the site's no-JS forms.
 *
 * `searchParams` is a Promise — Next 16 removed synchronous access entirely.
 */
export default async function ConfirmNewsletterPage(props: {
  searchParams: Promise<{ token?: string; state?: string }>;
}) {
  const { token, state } = await props.searchParams;

  // `state` means the POST already ran and redirected back here to show its
  // result. It carries no token and performs no write, so a scanner re-fetching
  // it is harmless. It is user-supplied, so normalise it to the known set.
  if (state) {
    const result: Result = state === "confirmed" || state === "already" ? state : "invalid";
    return <Outcome result={result} />;
  }

  // No token: nothing to confirm.
  if (!token) return <Outcome result="invalid" />;

  // A token, but no action yet. Show the confirm button. No write on this GET.
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-24 text-center">
      <p className="eyebrow text-dusty-text">The Atelier Letter</p>
      <h1 className="font-display mt-4 text-4xl font-light">One last step</h1>
      <p className="mt-4 text-sm opacity-80">
        Please confirm you&apos;d like to hear from the atelier — new arrivals,
        private trunk shows and the occasional story. A few times a season, never
        more.
      </p>

      <form action={confirmAction} className="mt-10">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" fullWidth>
          Confirm subscription
        </Button>
      </form>

      <Link href="/" className="eyebrow text-dusty-text mt-6 self-center">
        No thanks, return home
      </Link>
    </main>
  );
}

/**
 * Performs the state-changing confirmation. Only reachable via the form POST,
 * which is what keeps a prefetching scanner from opting anyone in.
 */
async function confirmAction(formData: FormData): Promise<void> {
  "use server";
  const token = String(formData.get("token") ?? "").trim();
  const result = token ? await confirmSubscription(token) : "invalid";
  redirect(`/newsletter/confirm?state=${result}`);
}

function Outcome({ result }: { result: Result }) {
  const copy = COPY[result];
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-24 text-center">
      <p className="eyebrow text-dusty-text">The Atelier Letter</p>
      <h1 className="font-display mt-4 text-4xl font-light">{copy.heading}</h1>
      <p className="mt-4 text-sm opacity-80">{copy.body}</p>
      <Link href="/" className="eyebrow bg-mocha text-cream mt-10 self-center px-8 py-4">
        Return home
      </Link>
    </main>
  );
}

async function confirmSubscription(token: string): Promise<Result> {
  const supabase = createAdminClient();

  const { data: subscriber } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status")
    .eq("confirm_token", token)
    .maybeSingle();

  if (!subscriber) return "invalid";
  if (subscriber.status === "confirmed") return "already";

  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", subscriber.id);

  if (error) {
    console.error("[newsletter] confirm failed:", error.message);
    return "invalid";
  }

  // Our database is the record of consent; Brevo is the delivery mechanism. If
  // this call fails the consent still stands, so log and continue rather than
  // telling the customer their confirmation failed.
  const added = await addMarketingContact(subscriber.email, { SOURCE: "website" });
  if (!added.ok) {
    console.error("[newsletter] brevo contact failed:", added.error);
  }

  return "confirmed";
}
