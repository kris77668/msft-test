import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts`. This is the file
 * `src/lib/supabase/server.ts` has always referred to in its comment — its
 * `setAll` swallows cookie writes because Server Components cannot set them,
 * and said "session refresh is handled in proxy.ts instead". Until now that
 * file did not exist, so the moment anyone signed in, refreshed tokens would
 * have been dropped and the session would silently expire.
 *
 * `getClaims()` is what actually performs the refresh — it verifies the JWT
 * and rotates it when near expiry. Removing it would leave users logged out at
 * apparently random intervals, which is close to impossible to debug from a
 * bug report.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Do not remove, and do not add code between the client and this call.
  const { data: claims } = await supabase.auth.getClaims();

  /*
   * Admin gate — a fast path, NOT the authorisation boundary.
   *
   * This only asks "is anyone signed in", because deciding whether they are an
   * ADMIN needs a profiles read, and middleware runs on every matched request
   * including every static-ish page. Paying a database round-trip there to
   * re-answer a question the page itself must ask anyway is a poor trade.
   *
   * The real check is `requireAdmin()` in src/app/admin/layout.tsx, which runs
   * server-side on every admin render, and again inside every server action.
   * Deleting this block would not expose anything; it would only mean a
   * signed-out visitor briefly renders the layout before being redirected.
   * Deleting `requireAdmin()` would expose the entire catalogue to any
   * signed-in customer.
   */
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images. The catalogue pages are
     * statically rendered and do not need a session, but excluding them by
     * path would mean a signed-in customer's header renders signed-out on the
     * one route they land on most.
     */
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
