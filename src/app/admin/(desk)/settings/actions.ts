"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/admin/result";

/**
 * Studio details.
 *
 * `site_settings` is a singleton — `id boolean primary key default true` with a
 * `check (id)` constraint, so exactly one row can ever exist. The upsert below
 * therefore always targets `id = true`; it is an upsert rather than an update
 * only so a fresh database with no row yet still works.
 *
 * These values appear in the footer, on the contact page, in structured data
 * and on tax invoices, so an empty ABN or a wrong suburb is visible in several
 * places at once.
 */

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const SettingsInput = z.object({
  studio_name: z.string().trim().min(1, "The studio needs a name."),
  legal_name: optionalText,
  studio_address_line: optionalText,
  studio_suburb: optionalText,
  studio_state: optionalText,
  studio_postcode: optionalText,
  studio_locality: optionalText,
  phone: optionalText,
  email: optionalText.refine(
    (value) => value === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    "That email address does not look right."
  ),
  instagram_url: optionalText.refine(
    (value) => value === null || /^https?:\/\//.test(value),
    "The Instagram link needs to start with https://"
  ),
  opening_hours: optionalText,
  abn: optionalText,
});

export async function saveSettings(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = SettingsInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const contentIsPlaceholder = formData.get("content_is_placeholder") === "on";
  const db = createAdminClient();

  const { error } = await db
    .from("site_settings")
    .upsert({ id: true, ...parsed.data, content_is_placeholder: contentIsPlaceholder });

  if (error) return fail(describeDbError(error));

  // The footer is on every page, so this is one of the few genuinely
  // site-wide invalidations.
  revalidatePath("/", "layout");

  return ok(
    contentIsPlaceholder
      ? "Saved. The site is still marked as carrying placeholder content."
      : "Saved. Placeholder warnings are now off across the site."
  );
}
