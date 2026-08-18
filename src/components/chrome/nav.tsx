"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { AccountIcon, BagIcon, CloseIcon } from "@/components/ui/icons";
import { PRIMARY_NAV, PRIMARY_CTA } from "@/data/navigation";
import { useCartCount } from "@/lib/cart/store";

/**
 * Site header — ported from core.jsx's <Nav>.
 *
 * Three fixes over the prototype:
 *
 *  1. It claimed in its README to solidify on scroll but never implemented it —
 *    there was no scroll listener at all, so the transparent-over-hero variant
 *    stayed transparent over white content as you scrolled. Implemented here.
 *  2. The mobile menu was a plain div toggled by a literal "☰" character, with
 *    no dialog semantics, no Escape handling, and no scroll lock behind it.
 *  3. It rendered a search icon wired to nothing — there is no search feature
 *    anywhere in the product. Omitted rather than shipping dead UI.
 */

export function Nav({
  transparent = false,
  cartCount,
}: {
  /** Overlays a full-bleed hero. Solidifies once scrolled past it. */
  transparent?: boolean;
  /**
   * Overrides the live bag count. Only the kitchen-sink page uses this, to
   * showcase the badge at a fixed value; leave it unset everywhere else.
   */
  cartCount?: number;
}) {
  const pathname = usePathname();
  // Read the count here rather than accepting it as a prop from each page.
  // It used to default to 0 and sixteen of eighteen call sites rendered a bare
  // <Nav />, so the badge was dead everywhere except /cart — add a gown from a
  // product page and the header never acknowledged it. useCartCount is
  // SSR-safe: it returns 0 until the store rehydrates, so server and client
  // first paint agree and the badge appears a frame later.
  const liveCount = useCartCount();
  const count = cartCount ?? liveCount;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 40);

    // The initial read is deferred to the next frame rather than called inline:
    // a synchronous setState in an effect body cascades an extra render before
    // paint. This still covers the case where the page loads already scrolled
    // (a refresh mid-page, or an anchor link).
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [transparent]);

  // Close on route change — otherwise the menu stays open over the new page.
  // Adjusted during render rather than in an effect: an effect that only
  // synchronises state to a prop causes an extra render pass, and React
  // recommends this form instead. Covers back/forward as well as link taps.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  // Escape to dismiss, and lock the page behind the menu so the body doesn't
  // scroll under the overlay on iOS.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const solid = !transparent || scrolled || open;

  return (
    <header
      className={clsx(
        "top-0 right-0 left-0 z-30 transition-colors duration-300",
        transparent ? "absolute" : "sticky",
        solid
          ? "bg-cream/90 border-softrule text-mocha border-b backdrop-blur-md backdrop-saturate-150"
          : "text-cream border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-4 md:px-8">
        {/* Left: desktop links, mobile menu toggle */}
        <div className="flex items-center gap-6 justify-self-start">
          {/* Tap targets are 44x44 minimum. The icons themselves are ~20px, so
              the surrounding box does the work — a 20px target is roughly half
              what a thumb reliably hits, and this header is the primary
              navigation for Instagram traffic arriving on a phone.
              Negative margin keeps the visual spacing unchanged. */}
          <button
            type="button"
            className="-m-3 flex h-11 w-11 items-center justify-center focus-visible:outline-offset-2 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon size={20} /> : <MenuGlyph />}
          </button>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            {PRIMARY_NAV.slice(0, 3).map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </nav>
        </div>

        <Link
          href="/"
          className="eyebrow flex h-11 items-center justify-self-center whitespace-nowrap"
        >
          Ms Fairy Tale
        </Link>

        <div className="-mr-2.5 flex items-center gap-1.5 justify-self-end md:gap-3">
          <nav className="mr-3 hidden items-center gap-6 md:flex" aria-label="Secondary">
            {PRIMARY_NAV.slice(3).map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </nav>

          <Link
            href="/account"
            aria-label="Account"
            className="flex h-11 w-11 items-center justify-center"
          >
            <AccountIcon size={19} />
          </Link>

          <Link
            href="/cart"
            className="relative flex h-11 w-11 items-center justify-center"
            aria-label={count === 1 ? "Bag, 1 item" : `Bag, ${count} items`}
          >
            <BagIcon size={19} />
            {count > 0 && (
              <span className="bg-mocha text-cream absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px]">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="bg-cream text-mocha border-softrule border-t md:hidden"
        >
          <nav className="flex flex-col px-5 py-4" aria-label="Primary">
            {PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "font-display border-softrule border-b py-3.5 text-2xl font-light last:border-b-0",
                  pathname.startsWith(item.href) && "italic"
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={PRIMARY_CTA.href}
              className="eyebrow border-gold text-mocha mt-5 border-[1.5px] px-6 py-4 text-center"
            >
              {PRIMARY_CTA.label}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "eyebrow border-b transition-opacity",
        active ? "border-current opacity-100" : "border-transparent opacity-75 hover:opacity-100"
      )}
    >
      {label}
    </Link>
  );
}

/** Three rules, rather than the prototype's literal "☰" text character. */
function MenuGlyph() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden>
      <path d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  );
}
