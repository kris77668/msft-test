"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/admin/result";

/**
 * Journal writes. Every action authorises first — see the note in
 * `products/actions.ts` for why a server action cannot rely on the layout.
 *
 * `published_at` IS the publish state: null is a draft, a future date is
 * scheduled, a past date is live. `journal_posts_public_read` compares it to
 * now(), so there is no separate status column and scheduling needs no cron.
 * The form exposes it as a single date, which keeps that one idea in one place.
 */

const CATEGORY = z.enum(["Real Wedding", "Journal"]);

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const JournalInput = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "A title is required."),
  slug: z
    .string()
    .trim()
    .min(1, "A web address is required.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "The web address can use lowercase letters, numbers and hyphens only."
    ),
  category: CATEGORY,
  excerpt: z.string().trim().min(1, "A short excerpt is required."),
  body_mdx: z.string().trim().min(1, "The article body is required."),
  cover_path: optionalText,
  cover_alt: optionalText,
  author_id: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, "Unknown author."),
  // Empty → null (draft). A date like "2026-05-12" is accepted by timestamptz.
  published_at: optionalText,
  read_minutes: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().int().min(0).max(120).nullable()
  ),
  seo_title: optionalText,
  seo_description: optionalText,
});

function revalidateJournal(slug: string, previousSlug?: string | null) {
  revalidatePath("/admin/journal");
  revalidatePath("/"); // the home page's "From the atelier" section
  revalidatePath("/journal");
  revalidatePath(`/journal/${slug}`);
  // A renamed post left its old URL serving a cached page; invalidate it too.
  if (previousSlug && previousSlug !== slug) revalidatePath(`/journal/${previousSlug}`);
}

export async function saveJournalPost(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = JournalInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
  }

  const { id, ...rest } = parsed.data;
  const columns = { ...rest, updated_at: new Date().toISOString() };

  const db = createAdminClient();

  // Fetch the old slug before updating, so a rename can invalidate the old URL.
  let previousSlug: string | null = null;
  if (id) {
    const { data: before } = await db
      .from("journal_posts")
      .select("slug")
      .eq("id", id)
      .maybeSingle();
    previousSlug = (before?.slug as string | undefined) ?? null;
  }

  const { error } = id
    ? await db.from("journal_posts").update(columns).eq("id", id)
    : await db.from("journal_posts").insert(columns);

  if (error) return fail(describeDbError(error));

  revalidateJournal(parsed.data.slug, previousSlug);

  const live = parsed.data.published_at && new Date(parsed.data.published_at) <= new Date();
  return ok(
    id
      ? live
        ? "Saved and live."
        : "Saved. It is not visible to customers until its date has passed."
      : "Post created."
  );
}

export async function deleteJournalPost(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Could not identify that post.");

  const db = createAdminClient();
  const { data, error } = await db
    .from("journal_posts")
    .delete()
    .eq("id", id.data)
    .select("slug")
    .single();

  if (error) return fail(describeDbError(error));

  revalidateJournal((data?.slug as string) ?? "");
  return ok("Post deleted.");
}
