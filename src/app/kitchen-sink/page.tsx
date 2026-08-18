import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Newsletter } from "@/components/chrome/newsletter";
import { Photo } from "@/components/ui/photo";
import { Button, ButtonLink } from "@/components/ui/button";
import { ModeTag } from "@/components/ui/mode-tag";
import { Stars } from "@/components/ui/stars";
import { Crumb } from "@/components/ui/crumb";
import { Reveal } from "@/components/ui/reveal";
import { CalendarIcon, HeartIcon, TruckIcon, RulerIcon } from "@/components/ui/icons";
import { formatMoney, formatMoneyRange, gstComponent, instalmentAmount } from "@/lib/money";
import { eligibleBnpl } from "@/lib/payments";
import { getProducts } from "@/lib/products/queries";
import { isBespoke } from "@/lib/products/types";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/**
 * Kitchen sink — every primitive on one page, rendered against real catalogue
 * data. Not linked from anywhere; it exists so the design system can be reviewed
 * against the handoff in one pass, and so regressions are obvious.
 */
export default async function KitchenSinkPage() {
  const products = await getProducts({ limit: 6 });
  const rtw = products.find((p) => p.kind === "rtw");
  const gown = products.find(isBespoke);

  return (
    <>
      <Nav cartCount={2} />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-14 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Design system" }]} />

        <h1 className="font-display mt-6 text-5xl font-light md:text-6xl">
          The <em className="italic">Whispered</em> system
        </h1>
        <p className="mt-4 max-w-xl text-sm opacity-80">
          Every primitive, rendered against live catalogue data from Supabase.
        </p>

        {/* ── Typography ─────────────────────────────────────────────── */}
        <Section title="Typography">
          <div className="space-y-5">
            <p className="eyebrow text-dusty-text">Eyebrow · Jost 11px · 0.32em</p>
            <p className="font-display text-6xl font-light">
              Display, <em className="italic">italic</em>
            </p>
            <p className="font-display text-3xl font-light">Cormorant Garamond 300</p>
            <p className="max-w-2xl text-base">
              Body copy is Jost at weight 300, line-height 1.7. The minimum is
              12px — the prototype floored at 8.5px, which contradicted its own
              stated floor and was genuinely hard to read at this tracking.
            </p>
          </div>
        </Section>

        {/* ── Palette ────────────────────────────────────────────────── */}
        <Section title="Palette">
          <div className="flex flex-wrap gap-3">
            {[
              ["cream", "bg-cream"],
              ["paper", "bg-paper"],
              ["blush", "bg-blush"],
              ["rose", "bg-rose"],
              ["dusty", "bg-dusty"],
              ["gold", "bg-gold"],
              ["mocha", "bg-mocha"],
              ["ink", "bg-ink"],
            ].map(([name, cls]) => (
              <div key={name}>
                <div className={`${cls} border-rule h-16 w-24 border`} />
                <span className="mt-1.5 block text-xs">{name}</span>
              </div>
            ))}
          </div>

          <div className="border-gold bg-paper mt-8 border-l-2 p-5">
            <p className="eyebrow text-gold-text">Accessibility</p>
            <p className="mt-3 max-w-2xl text-sm">
              <strong className="font-normal">rose (2.02:1)</strong>,{" "}
              <strong className="font-normal">dusty (2.79:1)</strong> and{" "}
              <strong className="font-normal">gold (2.58:1)</strong> all fail WCAG
              AA on cream, and rose fails even the large-text threshold. They are
              for fills, borders, numerals and 24px+ display type.
            </p>
            <p className="mt-3 text-sm">
              For text under 24px use the darkened variants:{" "}
              <span className="text-dusty-text">dusty-text</span>,{" "}
              <span className="text-gold-text">gold-text</span>,{" "}
              <span className="text-rose-text">rose-text</span>. Verify with{" "}
              <code className="text-xs">npm run check:contrast</code>.
            </p>
          </div>
        </Section>

        {/* ── The two paths ──────────────────────────────────────────── */}
        <Section title="The two paths">
          <div className="grid gap-6 md:grid-cols-2">
            {rtw && rtw.kind === "rtw" && (
              <article className="border-rule bg-cream border p-6">
                <ModeTag kind={rtw.kind} />
                <Photo
                  src={rtw.images[0]?.path ?? "/images/fashion/evening-dress-ms-fairy-tale-001.jpg"}
                  alt={rtw.images[0]?.alt ?? rtw.name}
                  ratio={3 / 4}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="mt-5"
                />
                <h3 className="font-display mt-5 text-2xl font-light">{rtw.name}</h3>
                <p className="text-dusty-text mt-1 text-sm">{rtw.colour}</p>
                <p className="font-display mt-4 text-3xl">{formatMoney(rtw.priceCents)}</p>
                <p className="text-dusty-text mt-1 text-xs">
                  incl. {formatMoney(gstComponent(rtw.priceCents))} GST
                </p>

                {eligibleBnpl(rtw.priceCents).map((p) => (
                  <p key={p.id} className="text-dusty-text mt-1 text-xs">
                    or {p.instalments} payments of{" "}
                    {formatMoney(instalmentAmount(rtw.priceCents, p.instalments))} with {p.label}
                  </p>
                ))}

                <div className="mt-5 flex flex-wrap gap-2">
                  {rtw.sizes.map((s) => (
                    <span key={s.label} className="border-rule border px-3 py-1.5 text-xs">
                      {s.label}
                    </span>
                  ))}
                </div>

                <Button variant="primary" fullWidth className="mt-5">
                  Add to Cart
                </Button>
                <p className="text-dusty-text mt-3 flex items-center gap-2 text-xs">
                  <TruckIcon size={14} /> {rtw.leadTimeNote}
                </p>
              </article>
            )}

            {gown && (
              <article className="border-rule bg-paper border p-6">
                <ModeTag kind={gown.kind} />
                <Photo
                  src={gown.images[0]?.path ?? "/images/fashion/wedding-dress-ms-fairy-tale-001.jpg"}
                  alt={gown.images[0]?.alt ?? gown.name}
                  ratio={3 / 4}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="mt-5"
                />
                <h3 className="font-display mt-5 text-2xl font-light">{gown.name}</h3>

                {/* No price tag, no size selector — structurally impossible to
                    render one here: BespokeGown has neither field. */}
                <p className="text-gold-text mt-4 text-sm">
                  Investment from{" "}
                  <span className="font-display text-2xl">
                    {formatMoneyRange(gown.priceFromCents, gown.priceToCents)}
                  </span>
                </p>
                <p className="mt-3 text-sm opacity-80">
                  A made-to-you commission, not an off-the-rack purchase.
                </p>

                <Button variant="bespoke" fullWidth className="mt-5">
                  <CalendarIcon size={16} /> Book a Consultation
                </Button>
                <div className="mt-3 flex gap-3">
                  <Button variant="secondary" size="sm" fullWidth>
                    <HeartIcon size={13} /> Save
                  </Button>
                  <Button variant="secondary" size="sm" fullWidth>
                    Ask a Question
                  </Button>
                </div>
                <p className="text-dusty-text mt-3 flex items-center gap-2 text-xs">
                  <RulerIcon size={14} /> {gown.leadTimeNote}
                </p>
              </article>
            )}
          </div>
        </Section>

        {/* ── Buttons ────────────────────────────────────────────────── */}
        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Add to Cart</Button>
            <Button variant="bespoke">
              <CalendarIcon size={16} /> Book a Consultation
            </Button>
            <Button variant="secondary">Save</Button>
            <Button variant="ghost">Ask a Question</Button>
            <Button variant="primary" disabled>
              Select a Size
            </Button>
            <ButtonLink href="/shop" variant="secondary">
              As a link
            </ButtonLink>
          </div>
        </Section>

        {/* ── Misc ───────────────────────────────────────────────────── */}
        <Section title="Ratings, tags, motion">
          <div className="flex flex-wrap items-center gap-8">
            <Stars rating={5} />
            <ModeTag kind="rtw" />
            <ModeTag kind="bespoke" />
          </div>

          <Reveal delay={80} className="border-rule mt-8 border p-5">
            <p className="text-sm">
              This block fades and rises on scroll — unless{" "}
              <code className="text-xs">prefers-reduced-motion: reduce</code> is
              set, in which case it renders immediately visible. The prototype
              animated unconditionally.
            </p>
          </Reveal>
        </Section>
      </main>

      <Newsletter variant="band" source="kitchen-sink" />
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <div className="border-rule mb-7 flex items-center gap-4 border-b pb-3">
        <h2 className="eyebrow text-dusty-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}
