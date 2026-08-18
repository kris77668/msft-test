import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Admin identity.
 *
 * The role is read with the *user's own session* through `createServerSupabase`,
 * never with the secret key. That is deliberate and worth keeping:
 *
 *   - `profiles_owner_read` confines the read to the caller's own row, so this
 *     cannot be tricked into reporting on somebody else.
 *   - `profiles.role` is not writable by `authenticated` — migration
 *     20260721000010 revokes UPDATE on the column and re-grants only
 *     first_name, last_name and phone. Column privileges are checked before
 *     RLS, so a customer cannot promote themselves. There is a test for this.
 *
 * The order of operations in every admin surface is: authorise here FIRST, then
 * reach for `createAdminClient()`. Never the reverse. `src/lib/supabase/admin.ts`
 * says it plainly — the secret key bypasses RLS entirely, so it is only ever
 * safe behind a check that has already happened.
 */

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
}

/**
 * The authenticated user, revalidated against the auth server.
 *
 * getUser() revalidates the JWT against the auth server. getSession() reads it
 * from a cookie and trusts it, which is not good enough to gate on.
 *
 * Wrapped in React `cache()` so `requireAdmin` and `getAdminUser` — which every
 * admin surface calls in sequence — share one auth-server round trip per
 * request rather than each paying their own. cache() is per-request, so the
 * revalidation guarantee is unchanged: a stale JWT still fails on the next
 * request.
 */
const currentUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The signed-in admin, or null for signed-out users and non-admin customers. */
export const getAdminUser = cache(async function getAdminUser(): Promise<AdminUser | null> {
  const user = await currentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return null;

  return {
    id: user.id,
    email: user.email ?? "",
    firstName: (profile.first_name as string | null) ?? null,
  };
});

/**
 * Gate a page or server action on admin. Redirects rather than throwing, so an
 * expired session lands on the sign-in form instead of an error boundary.
 *
 * A signed-in *customer* who guesses the URL is sent to `/` rather than the
 * sign-in form: they are already authenticated, so offering them a login box
 * would be a confusing loop, and confirming "this is the admin area, you're
 * simply not in it" tells them more than they need to know.
 */
export async function requireAdmin(): Promise<AdminUser> {
  // Both calls resolve through the cached `currentUser`, so a signed-in customer
  // guessing the URL costs one auth-server round trip, not two.
  const user = await currentUser();
  if (!user) redirect("/admin/login");

  const admin = await getAdminUser();
  if (!admin) redirect("/");

  return admin;
}
