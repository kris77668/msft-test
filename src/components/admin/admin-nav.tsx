"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { clsx } from "@/lib/clsx";

const SECTIONS = [
  { href: "/admin", label: "Desk" },
  { href: "/admin/products", label: "Gowns" },
  { href: "/admin/journal", label: "Journal" },
  { href: "/admin/faqs", label: "FAQs" },
  { href: "/admin/testimonials", label: "Testimonials" },
  { href: "/admin/settings", label: "Studio" },
] as const;

/**
 * Admin navigation.
 *
 * Client-side only for `usePathname` and the sign-out call. It carries no data
 * beyond the signed-in email, so nothing sensitive crosses to the browser.
 *
 * "Gowns" rather than "Products" throughout the admin: the people using this
 * are the atelier, and the website already speaks to them in their own words.
 */
export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <header className="border-rule bg-paper border-b">
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 md:px-8">
        <Link href="/admin" className="font-display text-lg font-light">
          Ms Fairy Tale
        </Link>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {SECTIONS.map((section) => {
            // "/admin" would otherwise match every child route.
            const active =
              section.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(section.href);

            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "eyebrow py-1 transition-colors",
                  active
                    ? "border-mocha text-mocha border-b"
                    : "text-dusty-text hover:text-mocha border-b border-transparent"
                )}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div className="text-dusty-text ml-auto flex items-center gap-4 text-xs">
          <Link href="/" className="hover:text-mocha transition-colors">
            View site ↗
          </Link>
          <span className="hidden sm:inline" title={email}>
            {email}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="hover:text-mocha cursor-pointer underline underline-offset-4 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
