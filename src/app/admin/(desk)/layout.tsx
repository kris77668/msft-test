import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Atelier desk", template: "%s · Atelier desk" },
  robots: { index: false, follow: false },
};

// A session is per-request, and draft content must never be cached at the edge.
export const dynamic = "force-dynamic";

/**
 * The admin shell.
 *
 * This is the project's first route group and first nested layout. The group
 * exists for one reason: a layout applies to every page beneath it, so putting
 * `requireAdmin()` in `admin/layout.tsx` would also gate `admin/login`, and a
 * signed-out visitor would be redirected to a sign-in page that redirects them
 * to the sign-in page. `login/` sits outside `(desk)/` so it stays reachable.
 *
 * `requireAdmin()` here is THE authorisation boundary for every page in this
 * group — the middleware gate in proxy.ts only checks that someone is signed
 * in. Server actions do not inherit it (a layout does not run before an action)
 * so each one calls `requireAdmin()` itself. That repetition is deliberate.
 */
export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="bg-cream flex min-h-screen flex-col">
      <AdminNav email={admin.email} />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-10 md:px-8">{children}</main>
      <footer className="border-rule text-dusty-text mt-auto border-t px-5 py-5 text-xs md:px-8">
        <p className="mx-auto max-w-[1100px]">
          Changes here are live on the website and in the app the moment you save.
        </p>
      </footer>
    </div>
  );
}
