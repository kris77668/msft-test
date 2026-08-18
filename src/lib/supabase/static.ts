import { createClient } from "@supabase/supabase-js";

/**
 * Build-time Supabase client — publishable key, no cookies.
 *
 * `generateStaticParams` and `sitemap.ts` run during the build, where there is
 * no HTTP request and therefore no cookie store. Calling `cookies()` there is a
 * hard error in Next 16, so those callers need a client that doesn't reach for
 * a session.
 *
 * Still subject to RLS as the anonymous role, so it can only ever see published
 * rows — exactly what should be pre-rendered. Never use this for anything
 * user-specific; it has no session by design.
 */
export function createStaticSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
