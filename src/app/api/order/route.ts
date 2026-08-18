import { lookupOrder } from "@/lib/confirmation/lookup";
import { allowByIp, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Order lookup by confirmation token, for non-browser clients.
 *
 * The website renders `/confirmation?t=` server-side and needs no endpoint;
 * a mobile app cannot, so this exposes the same `lookupOrder`.
 *
 * Rate-limited despite the token being 244 bits of entropy. Not because
 * guessing is plausible — it is not — but because an unmetered lookup endpoint
 * against the admin client is the kind of thing that becomes a problem later,
 * and the limiter already exists.
 *
 * "Not found" and "expired" are reported distinctly and both as 404. The
 * distinction is useful to a customer holding a real but stale link, and it
 * leaks nothing: you cannot reach either answer without a valid-length token
 * you were given.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await allowByIp("order-lookup", RATE_LIMITS.checkoutIp))) {
    return Response.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const token = new URL(req.url).searchParams.get("t");

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await lookupOrder(token);

  if (result.state === "not-found") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (result.state === "expired") {
    return Response.json(
      { error: "expired", message: "Order confirmation links are valid for 30 days." },
      { status: 404 }
    );
  }

  return Response.json(result.data);
}
