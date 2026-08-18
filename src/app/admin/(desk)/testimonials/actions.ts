"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/admin/result";

/**
 * Testimonial writes.
 *
 * ── Why approving is not just a status flip ──────────────────────────────
 *
 * `testimonials_public_read` is `status = 'approved' and is_placeholder = false`,
 * so a seeded example cannot reach the site by being approved — the placeholder
 * flag has to come off too, which is a second, deliberate act.
 *
 * `is_consented` gates Review/AggregateRating structured data separately. The
 * schema comment is blunt about why: publishing fabricated endorsements is
 * misleading conduct under Australian Consumer Law, and emitting review schema
 * for invented reviews turns a content problem into a Google penalty. So this
 * action refuses to approve a testimonial that is still flagged as placeholder
 * *and* has no consent recorded, rather than letting one click do both.
 */

const TestimonialInput = z.object({
  id: z.uuid().optional(),
  quote: z.string().trim().min(1, "A quote is required."),
  author: z.string().trim().min(1, "An author is required."),
  meta: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  image_path: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value)),
  rating: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 5),
      "A rating must be between 1 and 5."
    ),
  position: z.coerce.number().int().min(0).catch(0),
  status: z.enum(["pending", "approved", "rejected"]),
});

function revalidateTestimonials() {
  revalidatePath("/admin/testimonials");
  revalidatePath("/testimonials");
  revalidatePath("/");
}

export async function saveTestimonial(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = TestimonialInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const isPlaceholder = formData.get("is_placeholder") === "on";
  const isConsented = formData.get("is_consented") === "on";
  const { id, ...columns } = parsed.data;

  if (columns.status === "approved" && isPlaceholder) {
    return fail(
      "This is still marked as example copy, so it cannot go live. Replace it with a real testimonial and untick “example copy”."
    );
  }

  if (columns.status === "approved" && !isConsented) {
    return fail(
      "Record the client's permission before publishing their words. Tick “they agreed to this being published”."
    );
  }

  const db = createAdminClient();
  const row = { ...columns, is_placeholder: isPlaceholder, is_consented: isConsented };

  const { error } = id
    ? await db.from("testimonials").update(row).eq("id", id)
    : await db.from("testimonials").insert(row);

  if (error) return fail(describeDbError(error));

  revalidateTestimonials();

  return ok(
    columns.status === "approved" ? "Saved and live on the site." : "Saved. Not visible to customers."
  );
}

export async function deleteTestimonial(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Could not identify that testimonial.");

  const db = createAdminClient();
  const { error } = await db.from("testimonials").delete().eq("id", id.data);
  if (error) return fail(describeDbError(error));

  revalidateTestimonials();
  return ok("Testimonial deleted.");
}
