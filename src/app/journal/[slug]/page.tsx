import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Newsletter } from "@/components/chrome/newsletter";
import { Crumb } from "@/components/ui/crumb";
import { Photo } from "@/components/ui/photo";
import { ButtonLink } from "@/components/ui/button";
import { CalendarIcon } from "@/components/ui/icons";
import { getJournalPost, getJournalPosts, formatPostDate } from "@/lib/journal/queries";
import { JsonLd } from "@/components/seo/json-ld";
import { articleSchema, breadcrumbSchema } from "@/lib/seo/structured-data";

export async function generateStaticParams() {
  const posts = await getJournalPosts(100);
  return posts.map((post) => ({ slug: post.slug }));
}

export const revalidate = 3600;

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getJournalPost(slug);
  if (!post) return { title: "Not found" };

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    alternates: { canonical: `/journal/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      images: post.coverPath ? [{ url: post.coverPath }] : undefined,
    },
  };
}

export default async function JournalPostPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const post = await getJournalPost(slug);

  if (!post) notFound();

  const others = (await getJournalPosts(4)).filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      <JsonLd data={articleSchema(post)} />
      <JsonLd
        data={breadcrumbSchema([
          { label: "Home", href: "/" },
          { label: "Real Weddings", href: "/journal" },
          { label: post.title },
        ])}
      />

      <Nav />

      <main className="flex-1">
        <article className="mx-auto max-w-[720px] px-5 py-10 md:px-8">
          <Crumb
            items={[
              { label: "Home", href: "/" },
              { label: "Real Weddings", href: "/journal" },
              { label: post.title },
            ]}
          />

          <header className="mt-6">
            <p className="eyebrow text-gold-text">{post.category}</p>
            <h1 className="font-display mt-3 text-4xl leading-tight font-light md:text-5xl">
              {post.title}
            </h1>
            <p className="text-dusty-text mt-4 text-xs">
              {formatPostDate(post.publishedAt)}
              {post.readMinutes ? ` · ${post.readMinutes} min read` : ""}
            </p>
          </header>

          {post.coverPath && (
            <Photo
              src={post.coverPath}
              alt={post.coverAlt ?? post.title}
              ratio={3 / 2}
              sizes="(min-width: 768px) 720px, 100vw"
              priority
              className="mt-8"
            />
          )}

          {/* Body is stored as plain paragraphs for now. When the atelier needs
              richer formatting this becomes a proper MDX pipeline; the column is
              already named body_mdx for that reason. */}
          <div className="mt-10 flex flex-col gap-5 text-base leading-relaxed">
            {post.bodyMdx
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>

          <div className="border-rule mt-14 border-t pt-10 text-center">
            <p className="font-display text-2xl font-light">
              Every gown begins with a <em className="italic">conversation</em>
            </p>
            <ButtonLink href="/consultation" variant="bespoke" className="mt-6">
              <CalendarIcon size={16} /> Book a Consultation
            </ButtonLink>
          </div>
        </article>

        {others.length > 0 && (
          <section className="mx-auto max-w-[1200px] px-5 pb-16 md:px-8">
            <h2 className="eyebrow text-dusty-text border-rule border-b pb-3">
              More from the journal
            </h2>
            <ul className="mt-8 grid gap-x-6 gap-y-10 md:grid-cols-3">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link href={`/journal/${other.slug}`} className="group block">
                    {other.coverPath && (
                      <Photo
                        src={other.coverPath}
                        alt={other.coverAlt ?? other.title}
                        ratio={4 / 3}
                        sizes="(min-width: 768px) 33vw, 100vw"
                        imageClassName="transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    <h3 className="font-display mt-3 text-xl leading-tight font-light">
                      {other.title}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Newsletter variant="paper" source="journal-post" />
      <Footer />
    </>
  );
}
