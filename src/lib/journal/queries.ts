import { createStaticSupabase } from "@/lib/supabase/static";

/**
 * Journal reads.
 *
 * RLS filters on `published_at <= now()`, so drafts (null) and scheduled posts
 * (future) are invisible without any filter here — scheduling needs no cron job.
 */

export interface JournalPost {
  slug: string;
  title: string;
  category: "Real Wedding" | "Journal";
  excerpt: string;
  bodyMdx: string;
  coverPath: string | null;
  coverAlt: string | null;
  readMinutes: number | null;
  publishedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface Row {
  slug: string;
  title: string;
  category: JournalPost["category"];
  excerpt: string;
  body_mdx: string;
  cover_path: string | null;
  cover_alt: string | null;
  read_minutes: number | null;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
}

const SELECT =
  "slug, title, category, excerpt, body_mdx, cover_path, cover_alt, read_minutes, published_at, seo_title, seo_description";

const toPost = (row: Row): JournalPost => ({
  slug: row.slug,
  title: row.title,
  category: row.category,
  excerpt: row.excerpt,
  bodyMdx: row.body_mdx,
  coverPath: row.cover_path,
  coverAlt: row.cover_alt,
  readMinutes: row.read_minutes,
  publishedAt: row.published_at,
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
});

export async function getJournalPosts(limit = 30): Promise<JournalPost[]> {
  const supabase = createStaticSupabase();
  const { data, error } = await supabase
    .from("journal_posts")
    .select(SELECT)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getJournalPosts failed: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map(toPost);
}

export async function getJournalPost(slug: string): Promise<JournalPost | null> {
  const supabase = createStaticSupabase();
  const { data, error } = await supabase
    .from("journal_posts")
    .select(SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getJournalPost failed: ${error.message}`);
  return data ? toPost(data as unknown as Row) : null;
}

/** Formatted for display, in Australian convention. */
export function formatPostDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "long",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));
}
