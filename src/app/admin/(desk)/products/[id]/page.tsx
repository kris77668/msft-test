import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPhotoLibrary } from "@/lib/admin/photo-library";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm, type ProductFormValues, type Kind } from "../product-form";

export const metadata: Metadata = { title: "Edit gown" };

const BLANK: ProductFormValues = {
  kind: "bespoke",
  status: "draft",
  name: "",
  slug: "",
  description: "",
  lead_time_note: "",
  badge: "",
  colour: "",
  seo_title: "",
  seo_description: "",
  price: "",
  price_from: "",
  price_to: "",
  sizes: [],
  images: [],
};

/**
 * Create and edit share one route: `/admin/products/new` renders a blank form.
 * "new" is not a valid uuid, so it cannot collide with a real gown's id.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const photoLibrary = await listPhotoLibrary();

  if (id === "new") {
    return (
      <>
        <PageHeader
          title="Add a gown"
          description="It saves as a draft unless you choose otherwise, so nothing appears to customers until you are ready."
        />
        <ProductForm initial={BLANK} photoLibrary={photoLibrary} />
      </>
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .select(
      "id, kind, status, name, slug, description, lead_time_note, badge, colour, " +
        "seo_title, seo_description, price_cents, price_from_cents, price_to_cents, " +
        "product_sizes(label, in_stock, position), product_images(path, alt, position)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) notFound();

  const row = data as unknown as Record<string, unknown>;

  const sizes = ((row.product_sizes ?? []) as { label: string; in_stock: boolean; position: number }[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(({ label, in_stock }) => ({ label, in_stock }));

  const images = ((row.product_images ?? []) as { path: string; alt: string; position: number }[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(({ path, alt }) => ({ path, alt }));

  const initial: ProductFormValues = {
    id: row.id as string,
    kind: row.kind as Kind,
    status: row.status as ProductFormValues["status"],
    name: (row.name as string) ?? "",
    slug: (row.slug as string) ?? "",
    description: (row.description as string | null) ?? "",
    lead_time_note: (row.lead_time_note as string | null) ?? "",
    badge: (row.badge as string | null) ?? "",
    colour: (row.colour as string | null) ?? "",
    seo_title: (row.seo_title as string | null) ?? "",
    seo_description: (row.seo_description as string | null) ?? "",
    price: centsToDollars(row.price_cents as number | null),
    price_from: centsToDollars(row.price_from_cents as number | null),
    price_to: centsToDollars(row.price_to_cents as number | null),
    sizes,
    images,
  };

  return (
    <>
      <PageHeader title={initial.name} description={`Last saved as ${initial.status}.`} />
      <ProductForm initial={initial} photoLibrary={photoLibrary} />
    </>
  );
}

/**
 * Cents → an editable dollar string. Whole dollars lose the ".00" so the field
 * reads "2400" rather than "2400.00" — the atelier types whole dollars, and the
 * round trip through `dollarsToCents` is lossless either way.
 */
function centsToDollars(cents: number | null): string {
  if (cents == null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
