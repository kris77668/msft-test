import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { AddToCart } from "@/components/product/add-to-cart";
import { ProductCard } from "@/components/product/product-card";
import { TruckIcon } from "@/components/ui/icons";
import { formatMoney, gstComponent, instalmentAmount } from "@/lib/money";
import { eligibleBnpl } from "@/lib/payments";
import { getAllProductSlugs, getProductBySlug, getProducts } from "@/lib/products/queries";
import { isCartable } from "@/lib/products/types";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, productSchema } from "@/lib/seo/structured-data";

/** Pre-render every evening piece; ISR keeps them fresh after a price change. */
export async function generateStaticParams() {
  const slugs = await getAllProductSlugs(["rtw", "accessory"]);
  return slugs.map(({ slug }) => ({ slug }));
}

export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product || !isCartable(product)) return { title: "Not found" };

  const fabric = product.facets.find((f) => f.facetKey === "fabric")?.value;

  return {
    title: product.name,
    description:
      product.description ??
      `${product.name} — a made-to-order ${fabric?.toLowerCase() ?? ""} evening gown by Ms Fairy Tale, hand-finished in Sydney.`.replace(
        /\s+/g,
        " "
      ),
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      images: product.images[0] ? [{ url: product.images[0].path }] : undefined,
    },
  };
}

export default async function ProductPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  // A bespoke gown reached through /product/ is not a 404 — it exists, it is
  // simply not purchasable. Redirect to its consultation page rather than
  // showing a dead end or, worse, a cart button.
  if (!isCartable(product)) redirect(`/bespoke/${product.slug}`);

  const [cover, ...rest] = product.images;
  const related = (await getProducts({ kinds: ["rtw"], limit: 5 }))
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  const fabric = product.facets.find((f) => f.facetKey === "fabric")?.value;
  const silhouette = product.facets.find((f) => f.facetKey === "silhouette")?.value;
  const neckline = product.facets.find((f) => f.facetKey === "neckline")?.value;

  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Evening Wear", href: "/shop" },
    { label: product.name },
  ];

  return (
    <>
      {/* Product + Offer is correct HERE and only here — this item genuinely has
          a price and can be bought today. Bespoke gowns use Service instead. */}
      <JsonLd data={productSchema(product)} />
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <Nav />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-8 md:px-8 md:py-10">
        <Crumb items={crumbs} />

        <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
          {/* Gallery */}
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

          {/* Detail */}
          <div className="md:sticky md:top-24 md:self-start">
            <h1 className="font-display text-4xl leading-tight font-light md:text-5xl">
              {product.name}
            </h1>
            {product.colour && (
              <p className="text-dusty-text mt-1.5 text-sm">
                {product.colour}
                {fabric ? ` · ${fabric}` : ""}
              </p>
            )}

            <p className="font-display mt-5 text-3xl">{formatMoney(product.priceCents)}</p>
            <p className="text-dusty-text mt-1 text-xs">
              Includes {formatMoney(gstComponent(product.priceCents))} GST
            </p>

            {/* Only advertised where the customer can actually use it. */}
            {eligibleBnpl(product.priceCents).map((provider) => (
              <p key={provider.id} className="text-dusty-text mt-1 text-xs">
                or {provider.instalments} payments of{" "}
                {formatMoney(instalmentAmount(product.priceCents, provider.instalments))} with{" "}
                {provider.label}
              </p>
            ))}

            <div className="mt-8">
              <AddToCart product={product} />
            </div>

            <p className="text-dusty-text mt-5 flex items-center gap-2 text-xs">
              <TruckIcon size={14} />
              {product.leadTimeNote}
            </p>

            <dl className="border-rule mt-8 border-t text-sm">
              {silhouette && <Spec label="Silhouette" value={silhouette} />}
              {fabric && <Spec label="Fabric" value={fabric} />}
              {neckline && <Spec label="Neckline" value={neckline} />}
            </dl>

            <div className="border-rule mt-8 border-t pt-6 text-sm opacity-80">
              <p>
                Fully lined and hand-finished in the atelier. Made-to-order pieces
                are final sale — every measurement is confirmed with you before
                cutting. Professionally dry-clean only.
              </p>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <h2 className="eyebrow text-dusty-text border-rule border-b pb-3">
              You may also like
            </h2>
            <ul className="mt-7 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
              {related.map((item) => (
                <li key={item.slug}>
                  <ProductCard product={item} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-rule flex justify-between border-b py-3">
      <dt className="text-dusty-text">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
