import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Atelier sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin sign-in.
 *
 * Deliberately sparse: no nav, no footer, no "create an account" tab. Staff
 * accounts are made in the Supabase dashboard, so a sign-up form here would
 * only ever create customers who then cannot get in — and would tell anyone
 * who found the URL that this is a door worth knocking on.
 *
 * For the same reason a non-admin who signs in successfully is bounced to the
 * homepage by `requireAdmin()` rather than being told they lack a role.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const admin = await getAdminUser();
  const { next } = await searchParams;

  // Already signed in as an admin — skip the form.
  if (admin) redirect(safeNext(next));

  return (
    <main className="bg-cream flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-[380px]">
        <p className="eyebrow text-dusty-text">Ms Fairy Tale</p>
        <h1 className="font-display mt-3 text-3xl font-light">The atelier desk</h1>
        <p className="mt-3 text-sm opacity-70">
          Sign in to manage the catalogue, prices and studio details.
        </p>

        <AdminLoginForm next={safeNext(next)} />
      </div>
    </main>
  );
}

/**
 * Only ever redirect to a path on this site.
 *
 * `?next=https://evil.example` would otherwise turn the sign-in form into an
 * open redirect — the same guard `auth/callback/route.ts` applies, for the same
 * reason. A leading `//` is rejected too: browsers read `//host` as protocol-
 * relative and would leave the site.
 */
function safeNext(next: string | undefined): string {
  if (!next) return "/admin";
  if (!next.startsWith("/") || next.startsWith("//")) return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  return next;
}
