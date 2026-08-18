import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Newsletter } from "@/components/chrome/newsletter";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { JournalCard } from "@/components/journal/journal-card";
import { getJournalPosts, formatPostDate } from "@/lib/journal/queries";

export const metadata: Metadata = {
  title: "Real Weddings & Journal",
  description:
    "Real brides in Ms Fairy Tale gowns, and notes from the atelier on fabric, fittings and the making of a wedding dress.",
  alternates: { canonical: "/journal" },
};

export const revalidate = 600;

/**
 * Journal index.
 *
 * Entirely net-new. The prototype's STORIES array had no slug, body, date or
 * author, and every card linked back to this index — there was no article page
 * at all. Real Weddings is the organic acquisition engine for bridal, so it
 * needed a real content model rather than a decorative grid.
 */
export default async function JournalPage() {
  const posts = await getJournalPosts();
  const [feature, ...rest] = posts;

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Real Weddings" }]} />

        <header className="mt-6 max-w-xl">
          <h1 className="font-display text-4xl font-light md:text-5xl">
            Real weddings <em className="italic">& notes</em>
          </h1>
          <p className="mt-3 text-sm opacity-80">
            Brides in their gowns, and what we&apos;ve learned making them.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="mt-12 text-sm opacity-70">No stories published yet.</p>
        ) : (
          <>
            {feature && (
              <Link
                href={`/journal/${feature.slug}`}
                className="group mt-10 grid gap-6 md:grid-cols-2 md:items-center md:gap-10"
              >
                {feature.coverPath && (
                  <Photo
                    src={feature.coverPath}
                    alt={feature.coverAlt ?? feature.title}
                    ratio={4 / 3}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    priority
                    imageClassName="transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div>
                  <p className="eyebrow text-gold-text">{feature.category}</p>
                  <h2 className="font-display mt-3 text-3xl leading-tight font-light md:text-4xl">
                    {feature.title}
                  </h2>
                  <p className="mt-3 text-sm opacity-80">{feature.excerpt}</p>
                  <p className="text-dusty-text mt-4 text-xs">
                    {formatPostDate(feature.publishedAt)}
                    {feature.readMinutes ? ` · ${feature.readMinutes} min read` : ""}
                  </p>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <ul className="border-rule mt-16 grid gap-x-6 gap-y-12 border-t pt-12 md:grid-cols-3">
                {rest.map((post) => (
                  <li key={post.slug}>
                    <JournalCard post={post} sizes="(min-width: 768px) 33vw, 100vw" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <Newsletter variant="band" source="journal" />
      <Footer />
    </>
  );
}
