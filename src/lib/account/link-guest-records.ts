import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Attaches previous guest orders and consultations to an account.
 *
 * Every order placed before accounts existed — and every guest checkout since —
 * carries `user_id = null`, so without this an established client signs in and
 * sees an empty history, which reads as data loss rather than a migration gap.
 *
 * WHY THE VERIFICATION CHECK IS LOAD-BEARING
 * ------------------------------------------
 * The match is on email address, so this hands over whatever the address has
 * bought: full name, shipping address, phone, order contents, wedding date.
 * That is only safe if the address has been PROVEN to belong to the person
 * signing in.
 *
 * This used to live inside /auth/callback, where it was protected by accident:
 * the callback is reachable only by clicking a link sent to the address, so
 * confirmation was implied by arriving there at all. That protection does not
 * travel. Called from anywhere else — the account page, a server action — an
 * unconfirmed signup would be enough to claim a stranger's order history, and
 * whether signups are confirmed is a Supabase dashboard setting, not something
 * this repository controls.
 *
 * So the check is explicit and lives with the function rather than with any one
 * caller. An unverified user is a no-op, not an error: they are legitimately
 * signed in, they simply have not proven the address yet, and they will be
 * linked on a later visit once they confirm.
 *
 * Idempotent by construction — `.is("user_id", null)` means an already-linked
 * row is never touched, so calling this on every account page load is safe and
 * matches zero rows in the steady state. Both tables index `email`.
 */
export async function linkGuestRecords(user: User | null): Promise<void> {
  if (!user?.email) return;

  // Not yet proven to own this address. See above — this is the whole check.
  if (!user.email_confirmed_at) return;

  // The admin client, because RLS grants no UPDATE on orders to anyone — which
  // is the correct posture for a table that records money.
  const admin = createAdminClient();

  for (const table of ["orders", "consultations"] as const) {
    const { error } = await admin
      .from(table)
      .update({ user_id: user.id })
      .eq("email", user.email)
      .is("user_id", null);

    if (error) {
      // Not fatal. The customer is signed in; their history is merely
      // incomplete, and the next page load retries at no cost.
      console.error(`[account] could not link ${table} for ${user.id}:`, error.message);
    }
  }
}
