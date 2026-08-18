"use server";

import { subscribe } from "@/lib/newsletter/subscribe";

/**
 * Newsletter form action.
 *
 * A thin adapter: FormData in, `useActionState` shape out. The implementation
 * lives in `@/lib/newsletter/subscribe` so this and `POST /api/newsletter`
 * share one copy — the mobile app cannot call a server action, and duplicating
 * the double opt-in logic is how the rate limits eventually diverge.
 *
 * Kept as an action rather than pointed at the route handler so the footer form
 * still works without JavaScript.
 */

export type NewsletterState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  const outcome = await subscribe(formData.get("email"), formData.get("source"));

  return { status: outcome.status, message: outcome.message };
}
