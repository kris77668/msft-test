import type { Metadata } from "next";
import { Suspense } from "react";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { ProductCard } from "@/components/product/product-card";
import { FilterPanel } from "@/components/product/filter-panel";
import { ButtonLink } from "@/components/ui/button";
import { CalendarIcon } from "@/components/ui/icons";
import { getFacetGroups, getProducts } from "@/lib/products/queries";
import { parseFacetParams, shouldNoIndex } from "@/lib/products/facets";

/** Same faceted-indexing policy as /shop — see the note there. */
export async function generateMetadata(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const facets = parseFacetParams(await props.searchParams);

  return {
    title: "The Gown Gallery",
    description:
      "Bespoke wedding gowns, made to measure in Sydney. Every commission begins with a consultation — design, toile, and three fittings over 8–12 months.",
    alternates: { canonical: "/bespoke" },
    ...(shouldNoIndex(facets) ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * Bespoke bridal gallery.
 *
 * The visual counterpart to /shop, and deliberately different: paper rather than
 * cream, "From $X" rather than a price, and every card leading to a consultation
 * rather than a cart. No sort control — ranking commissions by price would frame
 * them as merchandise.
 */
export default async function BespokePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const facets = parseFacetParams(searchParams);

  const [gowns, groups] = await Promise.all([
    getProducts({ kinds: ["bespoke"], facets }),
    getFacetGroups(["bespoke"]),
  ]);

  return (
    <>
      <Nav />

      <main className="bg-paper flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-10 md:px-8">
          <Crumb items={[{ label: "Home", href: "/" }, { label: "Bridal" }]} />

          <header className="mt-6 max-w-2xl">
            <h1 className="font-display text-4xl font-light md:text-5xl">
              The gown <em className="italic">gallery</em>
            </h1>
            <p className="mt-3 text-sm opacity-80">
              Each gown is made to your measurements, not bought off a rail. These
              are starting points — yours will be its own.
            </p>
          </header>

          {/* The process, stated before any gown, so the commitment is clear
              before someone falls in love with a photograph. */}
          <ol className="border-rule mt-10 grid gap-6 border-y py-7 sm:grid-cols-3">
            {[
              ["I", "The consultation", "An hour together. Mood, fabric, story — no obligation."],
              ["II", "The toile", "A calico mock-up fitted to your exact body, pin by pin."],
              ["III", "Your gown", "Cut in your chosen fabric, hand-finished, across three fittings."],
            ].map(([numeral, title, body]) => (
              <li key={numeral}>
                <span className="font-display text-rose-text text-2xl">{numeral}</span>
                <h2 className="font-display mt-1 text-xl font-light">{title}</h2>
                <p className="mt-1.5 text-sm opacity-75">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-10 md:grid-cols-[210px_1fr] md:gap-12">
            <Suspense fallback={<div className="text-dusty-text text-xs">Loading filters…</div>}>
              <FilterPanel groups={groups} resultCount={gowns.length} />
            </Suspense>

            <div>
              {gowns.length === 0 ? (
                <div className="border-rule border px-6 py-16 text-center">
                  <p className="font-display text-2xl font-light">No gowns match those filters</p>
                  <ButtonLink href="/bespoke" variant="secondary" className="mt-6">
                    Clear filters
                  </ButtonLink>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
                  {gowns.map((gown, i) => (
                    <li key={gown.slug}>
                      <ProductCard product={gown} priority={i < 3} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <section className="bg-cream mt-16 px-5 py-16 text-center md:px-8">
          <h2 className="font-display text-3xl font-light md:text-4xl">
            Every gown begins with a <em className="italic">conversation</em>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm opacity-80">
            Private appointments Tuesday to Saturday. One hour, with the maker of
            your gown.
          </p>
          <ButtonLink href="/consultation" variant="bespoke" size="lg" className="mt-7">
            <CalendarIcon size={16} /> Book a Consultation
          </ButtonLink>
        </section>
      </main>

      <Footer />
    </>
  );
}
