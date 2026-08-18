import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { firstRelation } from "@/lib/supabase/embedded";

/**
 * Order and booking lookup by confirmation token.
 *
 * The token IS the credential. Guest checkout has no account, so a 244-bit
 * token in the URL is what proves the holder placed the order. That is also
 * why these reads use the admin client: RLS grants a signed-out visitor no
 * access to `orders`, and adding a public policy keyed on a token would make
 * the whole table readable to anyone able to guess one.
 *
 * Because the admin client bypasses RLS, the token comparison here is the only
 * thing standing between a caller and someone else's order. Never widen these
 * queries to accept anything but a full token — no prefix matching, no
 * `ilike`, no order-number fallback.
 *
 * Expiry is checked in code rather than in the query so an expired link can be
 * told apart from a wrong one and get its own message.
 */

/** Distinguishes "no such token" from "correct but too old". */
export type LookupResult<T> =
  | { state: "found"; data: T }
  | { state: "not-found" }
  | { state: "expired" };

export interface OrderConfirmation {
  orderNumber: string;
  status: string;
  totalCents: number;
  gstCents: number;
  email: string;
  items: {
    productName: string;
    size: string;
    qty: number;
    unitPriceCents: number;
  }[];
}

export interface BookingConfirmation {
  status: string;
  depositCents: number;
  email: string;
  firstName: string;
  startsAt: string | null;
  typeLabel: string | null;
}

export async function lookupOrder(token: string): Promise<LookupResult<OrderConfirmation>> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "order_number, status, total_cents, gst_cents, email, confirmation_expires_at, order_items(product_name, size, qty, unit_price_cents)"
    )
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!data) return { state: "not-found" };

  if (new Date(data.confirmation_expires_at) <= new Date()) {
    return { state: "expired" };
  }

  return {
    state: "found",
    data: {
      orderNumber: data.order_number,
      status: data.status,
      totalCents: data.total_cents,
      gstCents: data.gst_cents,
      email: data.email,
      items: (data.order_items ?? []).map((i) => ({
        productName: i.product_name,
        size: i.size,
        qty: i.qty,
        unitPriceCents: i.unit_price_cents,
      })),
    },
  };
}

export async function lookupBooking(token: string): Promise<LookupResult<BookingConfirmation>> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("consultations")
    .select(
      "status, deposit_cents, email, first_name, confirmation_expires_at, availability_slots(starts_at), consultation_types(label)"
    )
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!data) return { state: "not-found" };

  // 180 days, not the order's 30 — a gown consultation can be booked the better
  // part of a year before the wedding.
  if (new Date(data.confirmation_expires_at) <= new Date()) {
    return { state: "expired" };
  }

  return {
    state: "found",
    data: {
      status: data.status,
      depositCents: data.deposit_cents,
      email: data.email,
      firstName: data.first_name,
      startsAt: firstRelation(data.availability_slots)?.starts_at ?? null,
      typeLabel: firstRelation(data.consultation_types)?.label ?? null,
    },
  };
}
