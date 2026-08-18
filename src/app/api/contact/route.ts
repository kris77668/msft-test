import { submitEnquiry } from "@/lib/contact/submit";

export const runtime = "nodejs";

/**
 * Contact enquiry for non-browser clients.
 *
 * The website posts a form to the server action instead, so it keeps working
 * without JavaScript. Both call the same `submitEnquiry`.
 *
 * Accepts the contact schema as JSON. Note the `website` honeypot is part of
 * that schema: a native client should simply omit it, but it is accepted here
 * so the two entry points validate identically.
 *
 * A discarded honeypot submission and a throttled one both return 200 with the
 * ordinary success message. That is deliberate, not an oversight.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);

  const outcome = await submitEnquiry(body);

  return Response.json(
    {
      status: outcome.status,
      message: outcome.message,
      ...(outcome.fieldErrors ? { fieldErrors: outcome.fieldErrors } : {}),
    },
    { status: outcome.httpStatus }
  );
}
