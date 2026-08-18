import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Newsletter } from "@/components/chrome/newsletter";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { ButtonLink } from "@/components/ui/button";
import { getProducts } from "@/lib/products/queries";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Bridal and evening gowns from the Ms Fairy Tale atelier in Sydney — photographed in the studio and on our brides.",
  alternates: { canonical: "/gallery" },
};

export const revalidate = 3600;

/**
 * Photographic gallery across both lines.
 *
 * A CSS column masonry rather than a JS layout: it reflows natively, needs no
 * measurement pass, and does not shift after hydration.
 *
 * Each image links to the product it belongs to, so the gallery is a way into
 * the catalogue rather than a dead end. The prototype hardcoded 22 unrelated
 * image URLs that linked nowhere.
 */
export default async function GalleryPage() {
  const products = await getProducts({ limit: 60 });

  // Two images per product where available, so the wall has texture rather than
  // reading as a product grid with wider gaps.
  const images = products.flatMap((product) =>
    product.images.slice(0, 2).map((image) => ({
      ...image,
      slug: product.slug,
      name: product.name,
      href: product.kind === "bespoke" ? `/bespoke/${product.slug}` : `/product/${product.slug}`,
    }))
  );

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Gallery" }]} />

        <header className="mt-6 max-w-xl">
          <h1 className="font-display text-4xl font-light md:text-5xl">
            The <em className="italic">gallery</em>
          </h1>
          <p className="mt-3 text-sm opacity-80">
            Bridal and evening, photographed in the atelier. Every piece here links
            to its own page.
          </p>
        </header>

        {images.length === 0 ? (
          // Reachable with a full catalogue: this wall is built from product
          // photography, so every product having zero images empties it while
          // /shop and /bespoke still list normally. Without this the page
          // rendered a header, nothing, then the closing CTA.
          <div className="border-rule mt-10 border px-6 py-16 text-center">
            <p className="font-display text-2xl font-light">No photography yet</p>
            <p className="mt-2 text-sm opacity-75">
              The collections are still worth a look while we finish the gallery.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/bespoke" variant="secondary">
                Bridal
              </ButtonLink>
              <ButtonLink href="/shop" variant="secondary">
                Evening
              </ButtonLink>
            </div>
          </div>
        ) : (
        <div className="mt-10 columns-2 gap-3 md:columns-3 lg:columns-4 [&>a]:mb-3">
          {images.map((image, i) => (
            <a
              key={`${image.slug}-${image.path}-${i}`}
              href={image.href}
              className="group block break-inside-avoid focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <Photo
                src={image.path}
                alt={image.alt}
                // Varied ratios give the wall rhythm without a layout library.
                ratio={[3 / 4, 4 / 5, 1][i % 3]}
                sizes="(min-width: 1080px) 25vw, (min-width: 768px) 33vw, 50vw"
                priority={i < 4}
                imageClassName="transition-transform duration-700 group-hover:scale-105"
              />
              <span className="sr-only">{image.name}</span>
            </a>
          ))}
        </div>
        )}

        <section className="border-rule mt-16 border-t pt-12 text-center">
          <h2 className="font-display text-3xl font-light">
            Found something you <em className="italic">love?</em>
          </h2>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/bespoke" variant="bespoke">
              Browse bridal
            </ButtonLink>
            <ButtonLink href="/shop" variant="primary">
              Shop evening wear
            </ButtonLink>
          </div>
        </section>
      </main>

      <Newsletter variant="paper" source="gallery" />
      <Footer />
    </>
  );
}
