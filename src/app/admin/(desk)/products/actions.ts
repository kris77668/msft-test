"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeDbError, fail, ok, type ActionResult } from "@/lib/admin/result";

/**
 * Gown writes.
 *
 * EVERY action here calls `requireAdmin()` first. A server action is a public
 * HTTP endpoint with a generated name — it does NOT inherit the layout's guard,
 * because a layout does not run before an action. Anyone who can read the
 * client bundle can find the action id and POST to it. If you add an action to
 * this file without that first line, the catalogue is world-writable.
 *
 * ── The pricing shape ────────────────────────────────────────────────────
 *
 * `products_pricing_shape` is the two-path rule expressed in SQL: ready-to-wear
 * and accessories carry `price_cents` and nothing else; bespoke carries
 * `price_from_cents`/`price_to_cents` and no `price_cents`. The form branches on
 * kind, but a form can be replayed with any body, so `pricingFor()` below builds
 * the columns from the kind rather than from whatever the request supplied —
 * the unused columns are explicitly NULLed, never left as sent.
 *
 * This matters most when a gown CHANGES kind. An evening piece promoted to
 * bespoke that kept its `price_cents` would violate the constraint and, if the
 * constraint were ever dropped, would render a fixed price on a commission —
 * exactly the confusion the two-path model exists to prevent. The Flutter app
 * throws on that row rather than displaying it (see `Product.fromJson`).
 */

const KIND = z.enum(["rtw", "accessory", "bespoke"]);
const STATUS = z.enum(["draft", "published", "archived"]);

/**
 * Dollars as typed by a person → integer cents. "$2,400.50" → 240050.
 *
 * Rounded at the boundary, so cents are the only unit that ever reaches the
 * database. `src/lib/money.ts` states the rule: every amount is an integer
 * number of cents, never a float, because mixing units is how a $2,400 gown
 * gets charged as $24.
 */
const dollarsToCents = z
  .string()
  .trim()
  .transform((value) => value.replace(/[$,\s]/g, ""))
  .refine(
    (value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0,
    "Enter a price as a number, e.g. 2400"
  )
  .transform((value) => Math.round(Number(value) * 100));

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value));

const ProductInput = z.object({
  id: z.uuid().optional(),
  kind: KIND,
  status: STATUS,
  name: z.string().trim().min(1, "A gown needs a name."),
  slug: z
    .string()
    .trim()
    .min(1, "A gown needs a web address.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "The web address can use lowercase letters, numbers and hyphens only."
    ),
  description: optionalText,
  lead_time_note: optionalText,
  badge: optionalText,
  colour: optionalText,
  seo_title: optionalText,
  seo_description: optionalText,
  price: z.string().optional(),
  price_from: z.string().optional(),
  price_to: z.string().optional(),
});

type PricingColumns = {
  price_cents: number | null;
  price_from_cents: number | null;
  price_to_cents: number | null;
};

/** Build the pricing columns from the kind. Never trust the submitted shape. */
function pricingFor(
  input: z.infer<typeof ProductInput>
): { ok: true; value: PricingColumns } | { ok: false; error: string } {
  if (input.kind === "bespoke") {
    const from = dollarsToCents.safeParse(input.price_from ?? "");
    const to = dollarsToCents.safeParse(input.price_to ?? "");

    if (!from.success || !to.success) {
      return { ok: false, error: "A bespoke gown needs both a from and a to price." };
    }
    if (from.data <= 0 || to.data <= 0) {
      return { ok: false, error: "Bespoke prices must be more than zero." };
    }
    if (to.data < from.data) {
      return { ok: false, error: "The 'to' price cannot be lower than the 'from' price." };
    }

    return {
      ok: true,
      value: { price_cents: null, price_from_cents: from.data, price_to_cents: to.data },
    };
  }

  const price = dollarsToCents.safeParse(input.price ?? "");
  if (!price.success || price.data <= 0) {
    return { ok: false, error: "A ready-to-wear piece needs a price above zero." };
  }

  return {
    ok: true,
    value: { price_cents: price.data, price_from_cents: null, price_to_cents: null },
  };
}

function parseForm(formData: FormData) {
  return ProductInput.safeParse(Object.fromEntries(formData));
}

/** Rows for `product_sizes`, read from the repeatable size fields. */
function sizesFrom(formData: FormData, productId: string, kind: z.infer<typeof KIND>) {
  if (kind === "bespoke") return [];

  const labels = formData.getAll("size_label").map((v) => String(v).trim());
  const stocked = new Set(formData.getAll("size_in_stock").map((v) => String(v)));

  return labels
    .map((label, index) => ({ label, index }))
    .filter(({ label }) => label !== "")
    .map(({ label, index }, position) => ({
      product_id: productId,
      // Must match the parent's kind or the composite FK
      // (product_id, product_kind) → products(id, kind) rejects the row.
      product_kind: kind,
      label,
      // Contiguous even when a blank row was dropped above this one; `index` is
      // the original form position, kept only to match the checkbox's value.
      position,
      in_stock: stocked.has(String(index)),
    }));
}

/** Rows for `product_images`. A blank alt is rejected by the database. */
function imagesFrom(formData: FormData, productId: string) {
  const paths = formData.getAll("image_path").map((v) => String(v).trim());
  const alts = formData.getAll("image_alt").map((v) => String(v).trim());

  return paths
    .map((path, index) => ({ path, alt: alts[index] ?? "" }))
    .filter(({ path }) => path !== "")
    .map(({ path, alt }, position) => ({
      product_id: productId,
      path,
      alt,
      position,
    }));
}

/**
 * Replace the child rows for a gown.
 *
 * Delete-then-insert rather than diffing. The sets are tiny (a handful of sizes,
 * a few photos), positions are contiguous and reorderable, and a diff would need
 * stable ids surfaced through the form for no gain. It is not atomic with the
 * parent update — PostgREST has no transaction across calls — so a failure here
 * leaves the gown saved with its old children, which is recoverable by saving
 * again. That is a better failure than a half-written size list.
 */
async function replaceChildren(
  db: ReturnType<typeof createAdminClient>,
  productId: string,
  sizes: ReturnType<typeof sizesFrom>,
  images: ReturnType<typeof imagesFrom>
): Promise<string | null> {
  const dropSizes = await db.from("product_sizes").delete().eq("product_id", productId);
  if (dropSizes.error) return describeDbError(dropSizes.error);

  if (sizes.length > 0) {
    const { error } = await db.from("product_sizes").insert(sizes);
    if (error) return describeDbError(error);
  }

  const dropImages = await db.from("product_images").delete().eq("product_id", productId);
  if (dropImages.error) return describeDbError(dropImages.error);

  if (images.length > 0) {
    const { error } = await db.from("product_images").insert(images);
    if (error) return describeDbError(error);
  }

  return null;
}

/** The public detail URL for a gown, which differs by kind. */
function detailPath(slug: string, kind: z.infer<typeof KIND>): string {
  return kind === "bespoke" ? `/bespoke/${slug}` : `/product/${slug}`;
}

/**
 * Every surface a gown appears on, public and admin.
 *
 * `previous` is the gown's old detail path when a save changed its slug or kind.
 * Without revalidating it, the old URL keeps serving its cached page — stale
 * content, or a gown that has since moved — until that path's own TTL expires.
 */
function revalidateGown(slug: string, kind: z.infer<typeof KIND>, previous?: string | null) {
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/bespoke");
  revalidatePath("/gallery");
  // The cached facet counts on /shop and /bespoke are keyed by the `facets` tag,
  // NOT by path — revalidatePath above does not touch an unstable_cache entry.
  // Without this, adding or unpublishing a gown leaves the filter list showing
  // stale counts (or a missing new fabric) until the 1-hour backstop lapses.
  // `"max"` is Next 16's recommended profile (the bare single-arg form is
  // deprecated): the tag is marked stale and the next visit to either page
  // refreshes it in the background. See getFacetGroups in lib/products/queries.ts.
  revalidateTag("facets", "max");
  const current = detailPath(slug, kind);
  revalidatePath(current);
  if (previous && previous !== current) revalidatePath(previous);
}

export async function saveProduct(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Please check the form and try again.");
  }

  const input = parsed.data;
  const pricing = pricingFor(input);
  if (!pricing.ok) return fail(pricing.error);

  const db = createAdminClient();

  const columns = {
    kind: input.kind,
    status: input.status,
    name: input.name,
    slug: input.slug,
    description: input.description,
    lead_time_note: input.lead_time_note,
    badge: input.badge,
    // A commission has no single colourway to state.
    colour: input.kind === "bespoke" ? null : input.colour,
    seo_title: input.seo_title,
    seo_description: input.seo_description,
    ...pricing.value,
  };

  let productId = input.id;
  let previousPath: string | null = null;
  const isNew = !productId;

  if (productId) {
    // Capture the current slug/kind before mutating, so renaming a gown (or
    // flipping its kind, which moves it between /product and /bespoke) also
    // invalidates the URL it used to live at — see revalidateGown.
    const { data: before } = await db
      .from("products")
      .select("slug, kind")
      .eq("id", productId)
      .maybeSingle();
    previousPath = before
      ? detailPath(before.slug as string, before.kind as z.infer<typeof KIND>)
      : null;

    // Sizes must go before the parent update when a gown becomes bespoke:
    // `product_sizes_not_bespoke` and the composite FK both reject sizes whose
    // kind no longer matches, so the update would fail with rows still present.
    if (input.kind === "bespoke") {
      const { error } = await db.from("product_sizes").delete().eq("product_id", productId);
      if (error) return fail(describeDbError(error));
    }

    const { error } = await db.from("products").update(columns).eq("id", productId);
    if (error) return fail(describeDbError(error));
  } else {
    // New gowns go in as a draft and are promoted to their requested status
    // only after the child rows (photos, sizes) land — see below. A child
    // insert that failed here would otherwise leave a brand-new *published*
    // gown on the storefront with no photography, showing customers the bare
    // gradient placeholder. (An EXISTING gown edited to published keeps its old
    // photos on a child failure, so this only concerns freshly-created rows.)
    const { data, error } = await db
      .from("products")
      .insert({ ...columns, status: "draft" })
      .select("id")
      .single();
    if (error) return fail(describeDbError(error));
    productId = data.id as string;
  }

  const childError = await replaceChildren(
    db,
    productId,
    sizesFrom(formData, productId, input.kind),
    imagesFrom(formData, productId)
  );
  if (childError) {
    // Roll the new gown back so its slug is freed and the atelier can retry
    // cleanly. If the delete itself fails, the leftover is still only a draft —
    // it was never published above — so nothing reaches customers regardless.
    if (isNew) await db.from("products").delete().eq("id", productId);
    return fail(childError);
  }

  // Children are in place: promote the new gown to the status that was asked
  // for. Recoverable if this rare update fails — the gown is saved as a draft
  // and can be published from the list.
  if (isNew && input.status !== "draft") {
    const { error } = await db
      .from("products")
      .update({ status: input.status })
      .eq("id", productId);
    if (error) return fail(describeDbError(error));
  }

  revalidateGown(input.slug, input.kind, previousPath);

  return ok(
    input.status === "published"
      ? `${input.name} saved and live.`
      : `${input.name} saved as a ${input.status}. It is not visible to customers.`
  );
}

/** Publish / unpublish from the list, without opening the gown. */
export async function setProductStatus(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const id = z.uuid().safeParse(formData.get("id"));
  const status = STATUS.safeParse(formData.get("status"));
  if (!id.success || !status.success) return fail("Could not identify that gown.");

  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .update({ status: status.data })
    .eq("id", id.data)
    .select("name, slug, kind")
    .single();

  if (error) return fail(describeDbError(error));

  revalidateGown(data.slug as string, data.kind as z.infer<typeof KIND>);

  return ok(
    status.data === "published"
      ? `${data.name} is now live.`
      : `${data.name} is hidden from customers.`
  );
}

/**
 * Delete a gown.
 *
 * Images, sizes and facet links cascade. `order_items` does NOT — it snapshots
 * name, price and image at purchase time precisely so past orders survive the
 * catalogue changing, which means deleting a sold gown cannot corrupt an
 * invoice. Archiving is still the better habit and the form says so.
 */
export async function deleteProduct(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Could not identify that gown.");

  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .delete()
    .eq("id", id.data)
    .select("name, slug, kind")
    .single();

  if (error) return fail(describeDbError(error));

  revalidateGown(data.slug as string, data.kind as z.infer<typeof KIND>);

  // The gown's own page no longer exists, so staying here would 404 on the
  // next render. redirect() throws to unwind, hence no return after it.
  redirect("/admin/products");
}
