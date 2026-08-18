import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, formatMoneyRange } from "@/lib/money";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Pill, TableShell, EmptyRow } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { setProductStatus } from "./actions";

export const metadata: Metadata = { title: "Gowns" };

interface Row {
  id: string;
  kind: "rtw" | "accessory" | "bespoke";
  slug: string;
  name: string;
  status: "draft" | "published" | "archived";
  price_cents: number | null;
  price_from_cents: number | null;
  price_to_cents: number | null;
  updated_at: string;
  product_images: { path: string }[];
}

/**
 * Every gown, drafts included.
 *
 * This queries `products` directly with the admin client rather than going
 * through `search_products`. That RPC is SECURITY INVOKER *and* hardcodes
 * `where status = 'published'` as defence in depth, so it cannot list a draft
 * for anyone — which is exactly right for the two public clients and exactly
 * wrong here. Do not "fix" this page by relaxing the RPC.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  await requireAdmin();
  const { kind, status } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("products")
    .select(
      "id, kind, slug, name, status, price_cents, price_from_cents, price_to_cents, updated_at, product_images(path)"
    )
    .order("updated_at", { ascending: false });

  if (kind === "rtw" || kind === "accessory" || kind === "bespoke") {
    query = query.eq("kind", kind);
  }
  if (status === "draft" || status === "published" || status === "archived") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Gowns"
        description="Everything in the catalogue. Drafts are visible here only — customers see nothing until you publish."
        action={{ href: "/admin/products/new", label: "Add a gown" }}
      />

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2">
        <FilterGroup
          label="Type"
          param="kind"
          current={kind}
          options={[
            ["", "All"],
            ["bespoke", "Bridal"],
            ["rtw", "Evening"],
            ["accessory", "Accessories"],
          ]}
          other={status ? `status=${status}` : ""}
        />
        <FilterGroup
          label="State"
          param="status"
          current={status}
          options={[
            ["", "All"],
            ["published", "Live"],
            ["draft", "Draft"],
            ["archived", "Archived"],
          ]}
          other={kind ? `kind=${kind}` : ""}
        />
      </div>

      {error && (
        <Notice tone="error" size="sm" className="mb-6">
          Could not load the catalogue: {error.message}
        </Notice>
      )}

      <TableShell headings={["Gown", "Type", "Price", "State", ""]}>
        {rows.length === 0 ? (
          <EmptyRow colSpan={5}>
            {kind || status ? "Nothing matches that filter." : "No gowns yet."}
          </EmptyRow>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-softrule border-b last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/products/${row.id}`}
                  className="hover:text-dusty-text font-medium transition-colors"
                >
                  {row.name}
                </Link>
                <p className="text-dusty-text mt-0.5 text-xs">
                  /{row.slug} · {row.product_images?.length ?? 0} photo
                  {(row.product_images?.length ?? 0) === 1 ? "" : "s"}
                </p>
              </td>

              <td className="px-4 py-3">
                {row.kind === "bespoke" ? (
                  <Pill tone="draft">Bridal</Pill>
                ) : (
                  <Pill>{row.kind === "rtw" ? "Evening" : "Accessory"}</Pill>
                )}
              </td>

              <td className="px-4 py-3 whitespace-nowrap">{priceLabel(row)}</td>

              <td className="px-4 py-3">
                {row.status === "published" ? (
                  <Pill tone="live">Live</Pill>
                ) : row.status === "draft" ? (
                  <Pill tone="draft">Draft</Pill>
                ) : (
                  <Pill tone="muted">Archived</Pill>
                )}
              </td>

              <td className="px-4 py-3 text-right whitespace-nowrap">
                <ActionForm action={setProductStatus} className="inline">
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={row.status === "published" ? "draft" : "published"}
                  />
                  <button
                    type="submit"
                    className="eyebrow text-dusty-text hover:text-mocha cursor-pointer border-b border-transparent hover:border-current"
                  >
                    {row.status === "published" ? "Hide" : "Publish"}
                  </button>
                </ActionForm>
                <Link
                  href={`/admin/products/${row.id}`}
                  className="eyebrow text-dusty-text hover:text-mocha ml-4 border-b border-transparent hover:border-current"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))
        )}
      </TableShell>
    </>
  );
}

/**
 * A bespoke gown shows a range and never a single figure — a lone number reads
 * as a fixed, purchasable price, which is the confusion the two-path model
 * exists to prevent. The list obeys the same rule the storefront does.
 */
function priceLabel(row: Row): string {
  if (row.kind === "bespoke") {
    return row.price_from_cents != null && row.price_to_cents != null
      ? `From ${formatMoneyRange(row.price_from_cents, row.price_to_cents)}`
      : "—";
  }
  return row.price_cents != null ? formatMoney(row.price_cents) : "—";
}

function FilterGroup({
  label,
  param,
  current,
  options,
  other,
}: {
  label: string;
  param: string;
  current: string | undefined;
  options: [string, string][];
  other: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow text-dusty-text">{label}</span>
      {options.map(([value, text]) => {
        const query = [other, value ? `${param}=${value}` : ""].filter(Boolean).join("&");
        const active = (current ?? "") === value;

        return (
          <Link
            key={value || "all"}
            href={query ? `/admin/products?${query}` : "/admin/products"}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "border-mocha text-mocha border-b text-xs"
                : "text-dusty-text hover:text-mocha border-b border-transparent text-xs"
            }
          >
            {text}
          </Link>
        );
      })}
    </div>
  );
}
