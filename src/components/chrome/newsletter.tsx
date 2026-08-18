"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { subscribeToNewsletter, type NewsletterState } from "@/app/actions/newsletter";
import { clsx } from "@/lib/clsx";

/**
 * Newsletter signup — ported from core.jsx's <Newsletter>.
 *
 * The prototype validated with `email.includes("@")` and then set a success
 * state without sending anything anywhere. This posts to a server action that
 * writes to the database and dispatches a double opt-in email.
 *
 * The brief calls the newsletter the primary retention channel — more important
 * than the app — so this is a real integration rather than a styled box.
 */

const initialState: NewsletterState = { status: "idle" };

export function Newsletter({
  variant = "band",
  source = "footer",
}: {
  /** `band` = dark mocha section; `paper` = light inline block. */
  variant?: "band" | "paper";
  source?: string;
}) {
  const [state, formAction] = useActionState(subscribeToNewsletter, initialState);
  const dark = variant === "band";

  return (
    <section className={clsx("px-5 py-16 md:px-8 md:py-20", dark ? "bg-mocha text-cream" : "bg-paper text-mocha")}>
      <div className="mx-auto max-w-lg text-center">
        <p className={clsx("eyebrow", dark ? "opacity-70" : "text-dusty-text")}>
          The Atelier Letter
        </p>

        <h2 className="font-display mt-4 text-3xl font-light md:text-4xl">
          Be the <em className="italic">first</em> to know.
        </h2>

        <p className={clsx("mt-3 text-sm", dark ? "opacity-75" : "opacity-80")}>
          New arrivals, private trunk shows and atelier stories — a few times a
          season, never more.
        </p>

        {state.status === "success" ? (
          <p
            role="status"
            className={clsx("mt-8 text-sm", dark ? "text-cream" : "text-mocha")}
          >
            {state.message}
          </p>
        ) : (
          <form action={formAction} className="mt-8">
            <input type="hidden" name="source" value={source} />

            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                aria-invalid={state.status === "error" ? true : undefined}
                aria-describedby={state.status === "error" ? "newsletter-error" : undefined}
                className={clsx(
                  "flex-1 rounded-none border px-4 py-3.5 text-sm font-light",
                  "focus:outline-2 focus:outline-offset-2",
                  dark
                    ? "border-cream/25 text-cream placeholder:text-cream/40 focus:border-cream focus:outline-cream bg-transparent"
                    : "border-rule text-mocha placeholder:text-mocha/40 focus:border-mocha focus:outline-mocha bg-cream"
                )}
              />
              <SubmitButton dark={dark} />
            </div>

            {state.status === "error" && (
              <p
                id="newsletter-error"
                role="alert"
                className={clsx("mt-3 text-xs", dark ? "text-rose" : "text-error")}
              >
                {state.message}
              </p>
            )}

            <p className={clsx("mt-4 text-xs", dark ? "opacity-55" : "opacity-70")}>
              We&apos;ll send one email to confirm. Unsubscribe any time.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

function SubmitButton({ dark }: { dark: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "eyebrow rounded-none px-7 py-4 transition-opacity disabled:opacity-50",
        dark ? "bg-cream text-mocha" : "bg-mocha text-cream"
      )}
    >
      {pending ? "Sending…" : "Subscribe"}
    </button>
  );
}
