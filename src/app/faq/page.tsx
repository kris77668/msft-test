import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { ButtonLink } from "@/components/ui/button";
import { createStaticSupabase } from "@/lib/supabase/static";
import { Accordion } from "./accordion";
import { JsonLd } from "@/components/seo/json-ld";
import { faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "FAQ & Size Guide",
  description:
    "Ordering timeframes, sizing and measurements, alterations, gown care and shipping — everything we're most often asked.",
  alternates: { canonical: "/faq" },
};

export const revalidate = 86400;

/** AU sizing, in centimetres. */
const SIZE_CHART = [
  ["AU 6", "80", "63", "88"],
  ["AU 8", "84", "67", "92"],
  ["AU 10", "89", "72", "97"],
  ["AU 12", "94", "77", "102"],
  ["AU 14", "99", "82", "107"],
  ["AU 16", "106", "89", "114"],
];

export default async function FaqPage() {
  const supabase = createStaticSupabase();
  const { data } = await supabase
    .from("faqs")
    .select("category, question, answer")
    .eq("is_published", true)
    .order("position");

  const faqs = (data ?? []) as { category: string; question: string; answer: string }[];
  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <>
      {/* FAQPage markup can earn expanded results for "how long does a wedding
          dress take" style queries, which is exactly the bridal research phase. */}
      {faqs.length > 0 && <JsonLd data={faqSchema(faqs)} />}

      <Nav />

      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "FAQ & Size Guide" }]} />

        <h1 className="font-display mt-6 text-4xl font-light md:text-5xl">
          Questions, <em className="italic">answered</em>
        </h1>

        {categories.map((category) => (
          <section key={category} className="mt-12">
            <h2 className="eyebrow text-dusty-text border-rule border-b pb-3">{category}</h2>
            <Accordion items={faqs.filter((f) => f.category === category)} />
          </section>
        ))}

        {/* ── Size guide ─────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="eyebrow text-dusty-text border-rule border-b pb-3">Size guide</h2>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="text-dusty-text mb-3 text-left text-xs">
                Measurements in centimetres. Every made-to-order piece is cut to
                your measurements, so exact sizing matters less than it would off
                the rack.
              </caption>
              <thead>
                <tr className="border-rule border-b text-left">
                  {["Size", "Bust", "Waist", "Hip"].map((heading) => (
                    <th key={heading} scope="col" className="eyebrow py-3 font-normal">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIZE_CHART.map(([size, bust, waist, hip]) => (
                  <tr key={size} className="border-softrule border-b">
                    <th scope="row" className="py-3 text-left font-normal">
                      {size}
                    </th>
                    <td className="py-3">{bust}</td>
                    <td className="py-3">{waist}</td>
                    <td className="py-3">{hip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-paper mt-8 p-6">
            <h3 className="font-display text-xl font-light">Measuring at home</h3>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              {[
                ["Bust", "Around the fullest point, tape level and parallel to the floor."],
                ["Waist", "The narrowest part of your torso, usually just above the navel."],
                ["Hip", "Around the fullest part, roughly 20cm below the waist."],
              ].map(([term, how]) => (
                <div key={term}>
                  <dt className="font-normal">{term}</dt>
                  <dd className="opacity-80">{how}</dd>
                </div>
              ))}
            </dl>
            <p className="text-dusty-text mt-4 text-xs">
              Measure over your underwear, snug but not tight. Between sizes, we
              always advise the larger.
            </p>
          </div>
        </section>

        <section className="border-rule mt-16 border-t pt-10 text-center">
          <p className="font-display text-2xl font-light">Still not sure?</p>
          <p className="mt-2 text-sm opacity-80">
            Ask us directly — we&apos;d rather answer than have you guess.
          </p>
          <ButtonLink href="/contact" variant="secondary" className="mt-6">
            Get in touch
          </ButtonLink>
        </section>
      </main>

      <Footer />
    </>
  );
}
