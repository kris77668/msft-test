import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Newsletter } from "@/components/chrome/newsletter";
import { Photo } from "@/components/ui/photo";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { ProductCard } from "@/components/product/product-card";
import { JournalCard } from "@/components/journal/journal-card";
import { CalendarIcon } from "@/components/ui/icons";
import { getProducts } from "@/lib/products/queries";
import { getJournalPosts } from "@/lib/journal/queries";
import { getSiteSettings } from "@/lib/site/settings";

export const metadata: Metadata = {
  title: "Ms Fairy Tale — Haute Couture Bridal & Evening Wear, Sydney",
  description:
    "Bespoke wedding gowns made to measure, and ready-to-wear evening pieces. Hand-finished in Sydney. Private consultations Tuesday to Saturday.",
  alternates: { canonical: "/" },
};

export const revalidate = 3600;

/**
 * Home.
 *
 * The two-mode gateway below is the most important section on the site: it is
 * where a visitor self-selects into the bridal path (consultation, months) or
 * the evening path (cart, weeks). Getting that fork right is what stops someone
 * expecting to buy a wedding gown with a credit card.
 */
export default async function HomePage() {
  const [gowns, evening, journal, settings] = await Promise.all([
    getProducts({ kinds: ["bespoke"], limit: 6 }),
    getProducts({ kinds: ["rtw"], limit: 4 }),
    // A journal read must never take down the home page: it is the least
    // important section here and the most net-new query. Fall back to empty and
    // the section below simply does not render.
    getJournalPosts(3).catch(() => []),
    getSiteSettings(),
  ]);

  const locality = settings.locality ?? "Sydney";

  return (
    <>
      <Nav transparent />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative h-[85vh] min-h-[520px]">
        <Photo
          src="/images/fashion/wedding-dress-ms-fairy-tale-072.jpg"
          alt="A Ms Fairy Tale bride in a hand-finished bespoke gown"
          ratio="fill"
          sizes="100vw"
          priority
          dim={0.28}
        />
        <div className="text-onscrim absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="eyebrow">Sydney · Est. in the atelier</p>
          <h1 className="font-display mt-5 max-w-3xl text-5xl leading-[1.05] font-light md:text-7xl">
            Made by hand,
            <br />
            <em className="italic">for one woman.</em>
          </h1>
          <p className="mt-5 max-w-md text-sm opacity-90">
            Bridal couture by appointment. Evening wear ready to ship.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/bespoke" variant="primary">
              The Gown Gallery
            </ButtonLink>
            <ButtonLink
              href="/shop"
              variant="secondary"
              className="border-onscrim/50 text-onscrim hover:border-onscrim"
            >
              Evening Wear
            </ButtonLink>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* ── A note from the atelier ────────────────────────────── */}
        <section className="mx-auto max-w-2xl px-5 py-20 text-center md:px-8 md:py-28">
          <Reveal>
            <p className="eyebrow text-dusty-text">A note from the atelier</p>
            <p className="font-display mt-6 text-2xl leading-relaxed font-light md:text-3xl">
              We make one gown at a time. Not a collection, not a season — one
              woman, one dress, and the months in between spent getting it exactly
              right.
            </p>
          </Reveal>
        </section>

        {/* ── The two-mode gateway ───────────────────────────────── */}
        <section className="mx-auto grid max-w-[1400px] gap-px px-5 md:grid-cols-2 md:px-8">
          <Reveal>
            <article className="bg-paper flex h-full flex-col p-8 md:p-12">
              <p className="eyebrow text-gold-text">Bespoke · By appointment</p>
              <h2 className="font-display mt-4 text-3xl font-light md:text-4xl">
                Bridal
              </h2>
              <p className="mt-3 text-sm opacity-80">
                A commission, not a purchase. We design it with you, cut a toile to
                your body, and fit it three times before the day. Eight to twelve
                months, start to finish.
              </p>
              <div className="mt-auto pt-8">
                <ButtonLink href="/bespoke" variant="bespoke">
                  <CalendarIcon size={16} /> Begin with a consultation
                </ButtonLink>
              </div>
            </article>
          </Reveal>

          <Reveal delay={80}>
            <article className="bg-cream border-rule flex h-full flex-col border p-8 md:p-12">
              <p className="eyebrow text-dusty-text">Ready to wear</p>
              <h2 className="font-display mt-4 text-3xl font-light md:text-4xl">
                Evening
              </h2>
              <p className="mt-3 text-sm opacity-80">
                Made to order in your size and shipped in eight to ten weeks. Add
                to cart, pay with Afterpay or Zip, and wear it in a season rather
                than a year.
              </p>
              <div className="mt-auto pt-8">
                <ButtonLink href="/shop" variant="primary">
                  Shop evening wear
                </ButtonLink>
              </div>
            </article>
          </Reveal>
        </section>

        {/* ── Bridal grid ────────────────────────────────────────── */}
        {gowns.length > 0 && (
          <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-8 md:py-28">
            <div className="border-rule flex items-end justify-between border-b pb-4">
              <h2 className="font-display text-3xl font-light md:text-4xl">
                The gown <em className="italic">gallery</em>
              </h2>
              <Link href="/bespoke" className="eyebrow text-dusty-text flex min-h-11 items-center whitespace-nowrap">
                See all →
              </Link>
            </div>

            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
              {gowns.map((gown, i) => (
                <li key={gown.slug}>
                  <Reveal delay={(i % 3) * 60}>
                    <ProductCard product={gown} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── The process ────────────────────────────────────────── */}
        <section className="bg-blush px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-display text-center text-3xl font-light md:text-4xl">
              Three conversations, three fittings,
              <br />
              <em className="italic">one gown.</em>
            </h2>

            <ol className="mt-14 grid gap-10 md:grid-cols-3">
              {[
                [
                  "I.",
                  "The first sketch",
                  "Tea, a long table, and a tracing pad. Sketches arrive in your inbox within a week — yours to keep, regardless.",
                ],
                [
                  "II.",
                  "The toile",
                  "A mock-up in calico, fitted to your exact body. Pin by pin — sleeve length, neckline depth, the cut of the back.",
                ],
                [
                  "III.",
                  "The gown",
                  `Cut in your chosen fabric and hand-finished in ${locality}. Final fittings in the four weeks before the wedding.`,
                ],
              ].map(([numeral, title, body], i) => (
                <li key={numeral}>
                  <Reveal delay={i * 70}>
                    <span className="font-display text-rose-text text-3xl">{numeral}</span>
                    <h3 className="font-display mt-2 text-2xl font-light">{title}</h3>
                    <p className="mt-2 text-sm opacity-80">{body}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Evening edit ───────────────────────────────────────── */}
        {evening.length > 0 && (
          <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-8 md:py-28">
            <div className="border-rule flex items-end justify-between border-b pb-4">
              <div>
                <h2 className="font-display text-3xl font-light md:text-4xl">
                  The evening <em className="italic">edit</em>
                </h2>
                <p className="text-dusty-text mt-1 text-sm">
                  Ready to wear, with Afterpay and Zip.
                </p>
              </div>
              <Link href="/shop" className="eyebrow text-dusty-text flex min-h-11 items-center whitespace-nowrap">
                See all →
              </Link>
            </div>

            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
              {evening.map((piece, i) => (
                <li key={piece.slug}>
                  <Reveal delay={(i % 4) * 50}>
                    <ProductCard product={piece} />
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── From the atelier (journal) ─────────────────────────── */}
        {journal.length > 0 && (
          <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-8 md:py-28">
            <div className="border-rule flex items-end justify-between border-b pb-4">
              <div>
                <h2 className="font-display text-3xl font-light md:text-4xl">
                  From the <em className="italic">atelier</em>
                </h2>
                <p className="text-dusty-text mt-1 text-sm">
                  Real weddings, and notes on the making.
                </p>
              </div>
              <Link
                href="/journal"
                className="eyebrow text-dusty-text flex min-h-11 items-center whitespace-nowrap"
              >
                See all →
              </Link>
            </div>

            <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {journal.map((post, i) => (
                <li key={post.slug}>
                  <Reveal delay={(i % 3) * 50}>
                    <JournalCard
                      post={post}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Closing CTA ────────────────────────────────────────── */}
        <section className="bg-ink text-cream px-5 py-20 text-center md:px-8 md:py-28">
          <h2 className="font-display text-3xl font-light md:text-5xl">
            Come and see us
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm opacity-75">
            Private appointments Tuesday through Saturday{locality ? ` in ${locality}` : ""}. One
            hour. Tea is served.
          </p>
          <ButtonLink
            href="/consultation"
            variant="secondary"
            size="lg"
            className="border-cream/40 text-cream hover:border-cream mt-9"
          >
            <CalendarIcon size={16} /> Book a Consultation
          </ButtonLink>
        </section>
      </main>

      <Newsletter variant="band" source="home" />
      <Footer />
    </>
  );
}
