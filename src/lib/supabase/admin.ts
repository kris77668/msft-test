import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Admin client — bypasses Row Level Security entirely.
 *
 * The `server-only` import above is load-bearing: if any client component ever
 * imports this module, even transitively, the BUILD FAILS rather than shipping
 * the secret key to browsers.
 *
 * Use this only in route handlers and server actions, and only after the caller
 * has been authorised. Every write in this application goes through here, which
 * is why there is not a single INSERT/UPDATE/DELETE policy in the schema — the
 * browser is never trusted to mutate its own orders or prices.
 *
 * If you are reaching for this in a page or component, you almost certainly want
 * the anon-key server client instead.
 */
export function createAdminClient() {
  const env = getEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      // No session persistence or refresh: this client acts as the service, not
      // as a user, and must never pick up a browser session.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
