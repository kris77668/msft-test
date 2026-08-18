import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPhotoLibrary } from "@/lib/admin/photo-library";
import { Field, TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { PageHeader, Pill, SubmitButton, DangerSubmit } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveJournalPost, deleteJournalPost } from "./actions";

export const metadata: Metadata = { title: "Journal" };

interface Post {
  id: string;
  title: string;
  slug: string;
  category: "Real Wedding" | "Journal";
  excerpt: string;
  body_mdx: string;
  cover_path: string | null;
  cover_alt: string | null;
  author_id: string | null;
  read_minutes: number | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

interface Author {
  id: string;
  name: string;
}

const SELECT =
  "id, title, slug, category, excerpt, body_mdx, cover_path, cover_alt, author_id, read_minutes, published_at, seo_title, seo_description";

/**
 * The journal, edited in place.
 *
 * Same shape as the FAQ desk — an "add" form at the top, then each post in a
 * collapsed <details> with its own edit form — because the journal is a small,
 * hand-curated set, not a table that needs paging. Drafts (no date) sort to the
 * top: they are the ones waiting on a decision.
 */
export default async function JournalAdminPage() {
  await requireAdmin();
  const db = createAdminClient();

  const [postsRes, authorsRes, photoLibrary] = await Promise.all([
    db
      .from("journal_posts")
      .select(SELECT)
      .order("published_at", { ascending: false, nullsFirst: true }),
    db.from("journal_authors").select("id, name").order("name"),
    listPhotoLibrary(),
  ]);

  const posts = (postsRes.data ?? []) as Post[];
  const authors = (authorsRes.data ?? []) as Author[];

  return (
    <>
      <PageHeader
        title="Journal"
        description="Real Weddings and Journal posts. They appear on the site's Journal page, the home page, and the phone app. A post with no date stays a hidden draft until you give it one."
      />

      {postsRes.error && (
        <Notice tone="error" size="sm" className="mb-6">
          Could not load the posts: {postsRes.error.message}
        </Notice>
      )}

      {/* Suggestions for the cover field: photos already in use or deployed. */}
      <datalist id="photo-library">
        {photoLibrary.map((path) => (
          <option key={path} value={path} />
        ))}
      </datalist>

      {/* ── Add ────────────────────────────────────────────────────── */}
      <details className="border-rule mb-10 border">
        <summary className="eyebrow bg-paper cursor-pointer px-4 py-3">Write a new post</summary>
        <div className="p-5">
          <ActionForm action={saveJournalPost} successMessage>
            <JournalFields authors={authors} />
            <div className="mt-6">
              <SubmitButton>Create post</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>

      {/* ── Existing ───────────────────────────────────────────────── */}
      {posts.length === 0 ? (
        <p className="text-dusty-text text-sm">No posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const live = post.published_at !== null && new Date(post.published_at) <= new Date();
            const scheduled = post.published_at !== null && !live;

            return (
              <details key={post.id} className="border-rule border">
                <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1">{post.title}</span>
                  <span className="text-dusty-text hidden text-xs sm:inline">{post.category}</span>
                  {live ? (
                    <Pill tone="live">Live</Pill>
                  ) : scheduled ? (
                    <Pill tone="muted">Scheduled</Pill>
                  ) : (
                    <Pill tone="draft">Draft</Pill>
                  )}
                </summary>

                <div className="border-softrule border-t p-5">
                  <ActionForm action={saveJournalPost} successMessage>
                    <input type="hidden" name="id" value={post.id} />
                    <JournalFields post={post} authors={authors} />
                    <div className="mt-6">
                      <SubmitButton />
                    </div>
                  </ActionForm>

                  <ActionForm action={deleteJournalPost} className="border-softrule mt-5 border-t pt-4">
                    <input type="hidden" name="id" value={post.id} />
                    <DangerSubmit confirmMessage={`Delete "${post.title}"? This cannot be undone.`}>
                      Delete this post
                    </DangerSubmit>
                  </ActionForm>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}

const SELECT_CONTROL =
  "w-full min-h-11 bg-paper border border-rule px-3.5 py-3 text-sm font-light text-mocha " +
  "rounded-none transition-colors focus:border-mocha focus:outline-2 focus:outline-offset-2 focus:outline-mocha";

function JournalFields({ post, authors }: { post?: Post; authors: Author[] }) {
  return (
    <>
      <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
        <Field label="Title" name="title" defaultValue={post?.title ?? ""} required />
        <label className="block">
          <span className="eyebrow text-dusty-text mb-1.5 block">Category</span>
          <select
            name="category"
            defaultValue={post?.category ?? "Journal"}
            className={SELECT_CONTROL}
          >
            <option value="Journal">Journal</option>
            <option value="Real Wedding">Real Wedding</option>
          </select>
        </label>
      </div>

      <Field
        label="Web address"
        name="slug"
        defaultValue={post?.slug ?? ""}
        required
        hint="Lowercase letters, numbers and hyphens. Appears in the URL."
        className="mt-5"
      />

      <TextAreaField
        label="Excerpt"
        name="excerpt"
        defaultValue={post?.excerpt ?? ""}
        required
        rows={2}
        hint="One or two sentences, shown on cards and previews."
        className="mt-5"
      />

      <TextAreaField
        label="Article"
        name="body_mdx"
        defaultValue={post?.body_mdx ?? ""}
        required
        rows={10}
        hint="The full post. Blank lines separate paragraphs."
        className="mt-5"
      />

      {/* ── Cover ──────────────────────────────────────────────────── */}
      <div className="border-softrule mt-6 border-t pt-5">
        <PhotoUploadField
          name="cover_path"
          label="Cover photo"
          defaultValue={post?.cover_path ?? ""}
          hint="Upload a new photo, or type the path of one already deployed."
        />
        <Field
          label="Photo description"
          name="cover_alt"
          defaultValue={post?.cover_alt ?? ""}
          hint="Read aloud by screen readers and used by search engines."
          className="mt-4"
        />
      </div>

      {/* ── Publishing ─────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <Field
          label="Publish date"
          name="published_at"
          type="date"
          defaultValue={post?.published_at ? post.published_at.slice(0, 10) : ""}
          hint="Leave blank to keep it a hidden draft. A future date schedules it."
        />
        <Field
          label="Read time (min)"
          name="read_minutes"
          type="number"
          min={0}
          defaultValue={post?.read_minutes ?? ""}
        />
        <label className="block">
          <span className="eyebrow text-dusty-text mb-1.5 block">Author</span>
          <select name="author_id" defaultValue={post?.author_id ?? ""} className={SELECT_CONTROL}>
            <option value="">—</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Search listing ─────────────────────────────────────────── */}
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field
          label="SEO title"
          name="seo_title"
          defaultValue={post?.seo_title ?? ""}
          hint="Optional. Falls back to the title."
        />
        <Field
          label="SEO description"
          name="seo_description"
          defaultValue={post?.seo_description ?? ""}
          hint="Optional. Falls back to the excerpt."
        />
      </div>
    </>
  );
}
