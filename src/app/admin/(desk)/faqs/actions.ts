"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/admin/result";

/**
 * FAQ writes. Every action authorises first — see the note in
 * `products/actions.ts` for why a server action cannot rely on the layout.
 */

const FaqInput = z.object({
  id: z.uuid().optional(),
  category: z.string().trim().min(1, "Choose or type a category."),
  question: z.string().trim().min(1, "A question is required."),
  answer: z.string().trim().min(1, "An answer is required."),
  position: z.coerce.number().int().min(0).catch(0),
  is_published: z.coerce.boolean().catch(false),
});

function revalidateFaqs() {
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
}

export async function saveFaq(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = FaqInput.safeParse({
    ...Object.fromEntries(formData),
    // An unticked checkbox submits nothing at all, so a missing key means
    // false rather than "leave it as it was".
    is_published: formData.get("is_published") === "on",
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  }

  const { id, ...columns } = parsed.data;
  const db = createAdminClient();

  const { error } = id
    ? await db.from("faqs").update(columns).eq("id", id)
    : await db.from("faqs").insert(columns);

  if (error) return fail(describeDbError(error));

  revalidateFaqs();
  return ok(id ? "Saved." : "Question added.");
}

export async function deleteFaq(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Could not identify that question.");

  const db = createAdminClient();
  const { error } = await db.from("faqs").delete().eq("id", id.data);
  if (error) return fail(describeDbError(error));

  revalidateFaqs();
  return ok("Question deleted.");
}
