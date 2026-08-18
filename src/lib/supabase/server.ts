import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client using the PUBLISHABLE key.
 *
 * Subject to RLS, and carries the signed-in user's session from cookies — so a
 * query for orders returns that customer's orders and nobody else's, enforced by
 * the database rather than by a WHERE clause we might forget.
 *
 * This is the default for reading in Server Components. Reach for the admin
 * client only when a mutation genuinely requires bypassing RLS.
 *
 * Note `cookies()` is awaited: Next 16 removed the synchronous form entirely.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled in proxy.ts instead; ignoring here is
            // the documented pattern, not a swallowed bug.
          }
        },
      },
    }
  );
}
