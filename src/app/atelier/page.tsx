import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { CalendarIcon } from "@/components/ui/icons";
import { getSiteSettings } from "@/lib/site/settings";

export const metadata: Metadata = {
  title: "The Atelier",
  description:
    "Ms Fairy Tale is a Sydney atelier making bespoke wedding gowns and evening wear by hand — one gown at a time.",
  alternates: { canonical: "/atelier" },
};

export const revalidate = 86400;

/**
 * Atelier statistics band. Null until real figures exist.
 *
 * The prototype claimed "17 years on Knox Street", "486 brides" and a founding
 * year of 2009 — all invented, none verifiable.
 *
 * This band used to be gated on `settings.contentIsPlaceholder`, which is the
 * WRONG signal and was a trap: that flag tracks whether the studio's contact
 * details are confirmed, so the moment the address and phone were filled in,
 * this band would have appeared on a live page presenting two literal
 * em-dashes as statistics. There are no columns in `site_settings` holding
 * these figures, so it is gated on the figures themselves.
 *
 * To enable: add real values here (and ideally columns to read them from).
 */
const ATELIER_STATS: [string, string][] | null = null;

export default async function AtelierPage() {
  const settings = await getSiteSettings();
  const locality = settings.locality ?? "Sydney";

  return (
    <>
      <Nav transparent />

      <section className="relative h-[70vh] min-h-[420px]">
        <Photo
          src="/images/fashion/fashion-boutique-gallery-03.jpg"
          alt="Inside the Ms Fairy Tale atelier"
          ratio="fill"
          sizes="100vw"
          priority
          dim={0.32}
        />
        <div className="text-onscrim absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="eyebrow">The atelier</p>
          <h1 className="font-display mt-5 max-w-2xl text-5xl leading-tight font-light md:text-6xl">
            Made by <em className="italic">hand</em>,
            <br />
            in {locality}.
          </h1>
        </div>
      </section>

      <main className="flex-1">
        <div className="mx-auto max-w-[860px] px-5 py-20 md:px-8 md:py-28">
          <Crumb items={[{ label: "Home", href: "/" }, { label: "Atelier" }]} />

          <Reveal>
            <p className="font-display mt-10 text-2xl leading-relaxed font-light md:text-3xl">
              We are a small studio. Four pairs of hands, one gown at a time, and a
              long table that has had a great many cups of tea on it.
            </p>
          </Reveal>

          <Reveal delay={60}>
            <div className="mt-10 flex flex-col gap-5 text-sm leading-relaxed opacity-85">
              <p>
                Every bespoke gown begins the same way — a conversation, a tracing
                pad, and a question about what you actually want to feel like on
                the day. Not what&apos;s in season, not what photographs well.
              </p>
              <p>
                From there it&apos;s a toile in calico, fitted to your exact body,
                pinned and re-pinned until the line is right. Only then do we cut
                into the real fabric. Three fittings follow, the last in the weeks
                before the wedding.
              </p>
              <p>
                Alongside the bridal work we make evening wear — the same hands,
                the same finishing, made to order in your size and shipped in eight
                to ten weeks rather than a year.
              </p>
            </div>
          </Reveal>

          {ATELIER_STATS && (
            <div className="border-rule mt-16 grid gap-8 border-y py-10 text-center sm:grid-cols-3">
              {ATELIER_STATS.map(([figure, label]) => (
                <div key={label}>
                  <p className="font-display text-4xl font-light">{figure}</p>
                  <p className="text-dusty-text mt-1 text-xs">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-16 grid gap-3 sm:grid-cols-2">
            <Photo
              src="/images/fashion/fashion-boutique-gallery-05.jpg"
              alt="Fabric and pattern pieces on the atelier table"
              ratio={4 / 5}
              sizes="(min-width: 640px) 50vw, 100vw"
            />
            <Photo
              src="/images/fashion/fashion-boutique-gallery-07.jpg"
              alt="A gown on the stand mid-fitting"
              ratio={4 / 5}
              sizes="(min-width: 640px) 50vw, 100vw"
            />
          </div>
        </div>

        <section className="bg-blush px-5 py-20 text-center md:px-8">
          <h2 className="font-display text-3xl font-light md:text-4xl">
            Two ways to <em className="italic">begin</em>
          </h2>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/consultation" variant="bespoke">
              <CalendarIcon size={16} /> Book a Consultation
            </ButtonLink>
            <ButtonLink href="/shop" variant="primary">
              Shop evening wear
            </ButtonLink>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
