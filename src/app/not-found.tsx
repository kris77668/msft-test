import Link from "next/link";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { ButtonLink } from "@/components/ui/button";

/**
 * 404. The prototype had none — an unknown hash silently rendered the homepage,
 * which is worse than an error page because the URL stays wrong and search
 * engines index duplicates.
 */
export default function NotFound() {
  return (
    <>
      <Nav />

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-24 text-center">
        <p className="eyebrow text-dusty-text">404</p>
        <h1 className="font-display mt-4 text-4xl font-light md:text-5xl">
          This page has <em className="italic">slipped away</em>
        </h1>
        <p className="mt-4 text-sm opacity-80">
          The link may be old, or the piece may no longer be available.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/bespoke" variant="bespoke">
            Browse bridal
          </ButtonLink>
          <ButtonLink href="/shop" variant="primary">
            Shop evening wear
          </ButtonLink>
        </div>

        <p className="text-dusty-text mt-8 text-sm">
          Or{" "}
          <Link href="/contact" className="underline">
            tell us what you were looking for
          </Link>
          .
        </p>
      </main>

      <Footer />
    </>
  );
}
