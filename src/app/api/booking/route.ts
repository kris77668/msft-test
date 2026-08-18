import { lookupBooking } from "@/lib/confirmation/lookup";
import { allowByIp, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Consultation booking lookup by confirmation token, for non-browser clients.
 *
 * Mirrors `/api/order`. The website renders `/consultation/confirmed?t=`
 * server-side; both call the same `lookupBooking`.
 *
 * Booking tokens last 180 days rather than the order's 30, because a gown
 * consultation is routinely booked the better part of a year ahead.
 */
export async function GET(req: Request): Promise<Response> {
  if (!(await allowByIp("booking-lookup", RATE_LIMITS.consultationIp))) {
    return Response.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const token = new URL(req.url).searchParams.get("t");

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await lookupBooking(token);

  if (result.state === "not-found") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (result.state === "expired") {
    return Response.json(
      { error: "expired", message: "Booking confirmation links are valid for 180 days." },
      { status: 404 }
    );
  }

  return Response.json(result.data);
}
