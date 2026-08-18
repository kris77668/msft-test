import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { ButtonLink } from "@/components/ui/button";
import { ModeTag } from "@/components/ui/mode-tag";
import { ProductCard } from "@/components/product/product-card";
import { BespokeInvestment } from "@/components/product/product-card";
import { CalendarIcon, RulerIcon } from "@/components/ui/icons";
import { getAllProductSlugs, getProductBySlug, getProducts } from "@/lib/products/queries";
import { isBespoke } from "@/lib/products/types";
import { JsonLd } from "@/components/seo/json-ld";
import { bespokeGownSchema, breadcrumbSchema } from "@/lib/seo/structured-data";

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs(["bespoke"]);
  return slugs.map(({ slug }) => ({ slug }));
}

export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const gown = await getProductBySlug(slug);
  if (!gown || !isBespoke(gown)) return { title: "Not found" };

  const fabric = gown.facets.find((f) => f.facetKey === "fabric")?.value;

  return {
    title: gown.name,
    description: `${gown.name} — a bespoke wedding gown in ${fabric ?? "your chosen fabric"}, made to measure in Sydney over 8–12 months.`,
    alternates: { canonical: `/bespoke/${gown.slug}` },
    openGraph: {
      title: gown.name,
      images: gown.images[0] ? [{ url: gown.images[0].path }] : undefined,
    },
  };
}

/**
 * Bespoke gown detail.
 *
 * Structurally cannot show a price tag, a size selector or an Add to Cart
 * button: `BespokeGown` has no `priceCents` and no `sizes`, so those fields do
 * not exist to render. The only action is booking a consultation.
 */
export default async function BespokeDetailPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const gown = await getProductBySlug(slug);

  if (!gown) notFound();
  // An evening piece reached via /bespoke/ belongs in the shop.
  if (!isBespoke(gown)) redirect(`/product/${gown.slug}`);

  const [cover, ...rest] = gown.images;
  const related = (await getProducts({ kinds: ["bespoke"], limit: 5 }))
    .filter((g) => g.slug !== gown.slug)
    .slice(0, 3);

  const spec = (key: string) => gown.facets.find((f) => f.facetKey === key)?.value;

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Bridal", href: "/bespoke" },
    { label: gown.name },
  ];

  return (
    <>
      {/* Service, NOT Product+Offer. An Offer would assert a price this gown can
          be bought at today, which is false and can surface a buy button in
          Google Shopping for an 8–12 month commission. */}
      <JsonLd data={bespokeGownSchema(gown)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <Nav />

      <main className="bg-paper flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
          <Crumb items={crumbs} />

          <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
            <div className="flex flex-col gap-3">
              {cover && (
                <Photo
                  src={cover.path}
                  alt={cover.alt}
                  ratio={3 / 4}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority
                />
              )}
              {rest.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {rest.map((image) => (
                    <Photo
                      key={image.path}
                      src={image.path}
                      alt={image.alt}
                      ratio={3 / 4}
                      sizes="(min-width: 768px) 25vw, 50vw"
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="md:sticky md:top-24 md:self-start">
              <ModeTag kind="bespoke" />

              <h1 className="font-display mt-5 text-4xl leading-tight font-light md:text-5xl">
                {gown.name}
              </h1>

              {/* Gold, in body copy, never a price tag — this is an indication,
                  not an amount anyone can pay today. */}
              <div className="mt-5">
                <BespokeInvestment
                  fromCents={gown.priceFromCents}
                  toCents={gown.priceToCents}
                />
              </div>

              <p className="mt-5 text-sm opacity-85">
                This is a made-to-you commission, not an off-the-rack purchase.
                {spec("silhouette") && spec("fabric") ? (
                  <>
                    {" "}
                    A {spec("silhouette")!.toLowerCase()} silhouette in{" "}
                    {spec("fabric")!.toLowerCase()}
                    {spec("neckline") ? `, with a ${spec("neckline")!.toLowerCase()} neckline` : ""}.
                  </>
                ) : null}
              </p>

              <ButtonLink
                href="/consultation"
                variant="bespoke"
                size="lg"
                fullWidth
                className="mt-7"
              >
                <CalendarIcon size={16} /> Book a Consultation
              </ButtonLink>

              <p className="text-dusty-text mt-4 flex items-center gap-2 text-xs">
                <RulerIcon size={14} /> {gown.leadTimeNote}
              </p>

              <dl className="border-rule mt-8 border-t text-sm">
                {(["silhouette", "fabric", "neckline"] as const).map((key) => {
                  const value = spec(key);
                  if (!value) return null;
                  return (
                    <div key={key} className="border-rule flex justify-between border-b py-3">
                      <dt className="text-dusty-text capitalize">{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  );
                })}
              </dl>

              <ol className="mt-8 flex flex-col gap-4">
                {[
                  ["I", "The consultation", "An hour together — mood, fabric, story."],
                  ["II", "The toile", "A calico mock-up fitted to your exact body."],
                  ["III", "Your gown", "Cut, hand-finished, across three fittings."],
                ].map(([numeral, title, body]) => (
                  <li key={numeral} className="flex gap-4">
                    <span className="font-display text-rose-text text-xl">{numeral}</span>
                    <div>
                      <p className="font-display text-lg font-light">{title}</p>
                      <p className="text-sm opacity-75">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {related.length > 0 && (
            <section className="mt-20">
              <h2 className="eyebrow text-dusty-text border-rule border-b pb-3">
                Other gowns
              </h2>
              <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
                {related.map((item) => (
                  <li key={item.slug}>
                    <ProductCard product={item} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
