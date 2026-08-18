"use server";

import { submitEnquiry } from "@/lib/contact/submit";

/**
 * Contact form action.
 *
 * A thin adapter: FormData in, `useActionState` shape out. The implementation
 * lives in `@/lib/contact/submit` so this and `POST /api/contact` share one
 * copy — the honeypot and rate-limit responses have to be byte-identical to an
 * ordinary success, and that is exactly the property a second copy loses.
 *
 * Kept as an action rather than pointed at the route handler so the form still
 * works without JavaScript.
 */

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const outcome = await submitEnquiry({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    eventDate: formData.get("eventDate") ?? "",
    collection: formData.get("collection"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });

  return {
    status: outcome.status,
    message: outcome.message,
    fieldErrors: outcome.fieldErrors,
  };
}
