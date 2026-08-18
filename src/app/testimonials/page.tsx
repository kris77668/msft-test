import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { Stars } from "@/components/ui/stars";
import { ButtonLink } from "@/components/ui/button";
import { createStaticSupabase } from "@/lib/supabase/static";

export const metadata: Metadata = {
  title: "What our brides say",
  description:
    "Reviews from brides and clients of the Ms Fairy Tale atelier in Sydney.",
  alternates: { canonical: "/testimonials" },
};

export const revalidate = 3600;

/**
 * Testimonials.
 *
 * RLS returns only rows that are `approved` AND not flagged as placeholder, so
 * the seeded examples never appear publicly. Review structured data is emitted
 * from Track D only for entries with `is_consented = true`; marking up invented
 * reviews would turn a content problem into a search penalty, on top of being
 * misleading conduct.
 */
export default async function TestimonialsPage() {
  const supabase = createStaticSupabase();
  const { data } = await supabase
    .from("testimonials")
    .select("quote, author, meta, rating, image_path")
    .order("position");

  const testimonials = (data ?? []) as {
    quote: string;
    author: string;
    meta: string | null;
    rating: number | null;
    image_path: string | null;
  }[];

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Testimonials" }]} />

        <header className="mt-6 max-w-xl">
          <h1 className="font-display text-4xl font-light md:text-5xl">
            In their <em className="italic">own words</em>
          </h1>
        </header>

        {testimonials.length === 0 ? (
          <div className="border-rule mt-12 border px-6 py-16 text-center">
            <p className="font-display text-2xl font-light">No reviews published yet</p>
            <p className="mt-2 text-sm opacity-75">
              We&apos;d rather show none than show invented ones.
            </p>
            <ButtonLink href="/consultation" variant="bespoke" className="mt-6">
              Book a consultation
            </ButtonLink>
          </div>
        ) : (
          <ul className="mt-12 columns-1 gap-6 md:columns-2 [&>li]:mb-6">
            {testimonials.map((testimonial) => (
              <li
                key={`${testimonial.author}-${testimonial.quote.slice(0, 20)}`}
                className="border-rule break-inside-avoid border p-6"
              >
                {testimonial.rating && <Stars rating={testimonial.rating} />}
                <blockquote className="font-display mt-4 text-xl leading-relaxed font-light">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="mt-5 flex items-center gap-3">
                  {testimonial.image_path && (
                    <Photo
                      src={testimonial.image_path}
                      alt=""
                      ratio={1}
                      sizes="48px"
                      className="w-12 shrink-0 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-sm">{testimonial.author}</p>
                    {testimonial.meta && (
                      <p className="text-dusty-text text-xs">{testimonial.meta}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </>
  );
}
