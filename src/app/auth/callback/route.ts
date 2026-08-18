import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { linkGuestRecords } from "@/lib/account/link-guest-records";

export const runtime = "nodejs";

/**
 * OAuth and email-confirmation landing.
 *
 * Shared by Apple, Google and the email confirmation link. Supabase sends the
 * customer here with a `code`; this exchanges it for a session cookie.
 *
 * `next` is validated as a same-site path before being used. An open redirect
 * on an auth callback is the classic way to hand someone's session to another
 * origin, and "it only ever comes from our own links" is exactly the
 * assumption that makes it exploitable.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requested = searchParams.get("next") ?? "/account";

  // Must start with a single slash: "//evil.com" is a protocol-relative URL
  // that browsers happily treat as another origin.
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/account";

  if (!code) {
    return NextResponse.redirect(`${origin}/account?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth] code exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/account?error=auth_failed`);
  }

  // Claim past guest orders. This runs again on every account page load, and
  // needs to: this route only fires on the confirmation-link and OAuth paths.
  // Password sign-in goes straight through `signInWithPassword` on the client
  // and never reaches here, so a failure at this point — or a guest order
  // placed AFTER the account was created — would otherwise never be picked up.
  //
  // KNOWN LIMITATION: Sign in with Apple's private relay addresses
  // (…@privaterelay.appleid.com) never match a guest order's email, so those
  // customers need the manual "link a past order" path using their
  // confirmation token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await linkGuestRecords(user);

  return NextResponse.redirect(`${origin}${next}`);
}
