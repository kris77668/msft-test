import { subscribe } from "@/lib/newsletter/subscribe";

export const runtime = "nodejs";

/**
 * Newsletter subscription for non-browser clients.
 *
 * The website posts a form to the server action instead, so it keeps working
 * without JavaScript. Both call the same `subscribe`.
 *
 * Accepts `{ email, source? }`. The response deliberately carries no signal
 * about whether the address was already subscribed or rate-limited — both are
 * reported as success with an identical message, because a distinguishable
 * reply turns this endpoint into a way to test who is on the list.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    source?: unknown;
  } | null;

  const outcome = await subscribe(body?.email, body?.source ?? "app");

  return Response.json(
    { status: outcome.status, message: outcome.message },
    { status: outcome.httpStatus }
  );
}
