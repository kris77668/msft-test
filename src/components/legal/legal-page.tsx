import Link from "next/link";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { getSiteSettings } from "@/lib/site/settings";

/**
 * Shared shell for legal pages.
 *
 * The content is DELIBERATELY NOT WRITTEN. Privacy policies, terms of sale,
 * refund and cancellation terms carry legal weight — they must be drafted or
 * reviewed by a lawyer who knows the business, not generated from a template.
 *
 * These routes exist because an e-commerce site cannot launch without them and
 * the footer links to them. The visible notice makes the gap impossible to miss,
 * and `noindex` keeps unfinished pages out of search.
 */
export async function LegalPage({
  title,
  crumbLabel,
  sections,
}: {
  title: string;
  crumbLabel: string;
  /** Headings the lawyer's copy needs to cover, as a brief. */
  sections: readonly string[];
}) {
  const settings = await getSiteSettings();

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: crumbLabel }]} />

        <h1 className="font-display mt-6 text-4xl font-light md:text-5xl">{title}</h1>

        <div className="border-gold bg-paper mt-8 border-l-2 p-5">
          <p className="eyebrow text-gold-text">Not yet finalised</p>
          <p className="mt-3 text-sm">
            This page is a placeholder. The wording must be prepared or reviewed by
            a legal professional before the site accepts payments — it is not
            something to draft from a template.
          </p>
        </div>

        <section className="mt-10">
          <p className="eyebrow text-dusty-text">To be covered</p>
          <ul className="mt-4 flex flex-col gap-2.5 text-sm opacity-80">
            {sections.map((section) => (
              <li key={section} className="border-softrule border-b pb-2.5">
                {section}
              </li>
            ))}
          </ul>
        </section>

        <p className="text-dusty-text mt-10 text-sm">
          In the meantime, please{" "}
          <Link href="/contact" className="underline">
            contact us
          </Link>{" "}
          with any question about orders, returns or your information
          {settings.email ? ` — or email ${settings.email}` : ""}.
        </p>
      </main>

      <Footer />
    </>
  );
}
