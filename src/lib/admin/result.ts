import type { PostgrestError } from "@supabase/supabase-js";
import {
  PG_FK_VIOLATION,
  PG_INSUFFICIENT_PRIVILEGE,
  PG_UNIQUE_VIOLATION,
} from "@/lib/supabase/errors";

/**
 * What every admin server action returns.
 *
 * Actions never throw for expected failures — a thrown error in a server action
 * surfaces as a generic "an error occurred" in production, which tells the
 * atelier nothing about the duplicate slug they just typed.
 */
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Turn a Postgres error into something the atelier can act on.
 *
 * The database is the last line of defence for several invariants the forms
 * also enforce, so most of these should be unreachable. They are mapped anyway:
 * an unreachable constraint that fires means a form has a bug, and "duplicate
 * key value violates unique constraint products_slug_key" is not a sentence
 * anyone should be shown.
 */
export function describeDbError(error: PostgrestError): string {
  const detail = `${error.message} ${error.details ?? ""}`;

  if (detail.includes("products_pricing_shape")) {
    return "The price does not match the gown type. Ready-to-wear needs a single price; bespoke needs a from and a to.";
  }
  if (detail.includes("products_slug_key") || detail.includes("products_slug")) {
    return "Another gown already uses that web address. Try a different one.";
  }
  if (detail.includes("product_sizes_product_id_label_key")) {
    return "That size is listed twice. Each size can only appear once per gown.";
  }
  if (detail.includes("product_sizes_not_bespoke")) {
    return "Bespoke gowns are made to measure and cannot have sizes.";
  }
  if (detail.includes("product_images_alt_not_blank")) {
    return "Every photo needs a description for screen readers and search engines.";
  }
  if (detail.includes("facet_values_facet_key_slug_key")) {
    return "That option already exists in this group.";
  }
  if (error.code === PG_FK_VIOLATION) {
    return "Something this refers to no longer exists. Reload the page and try again.";
  }
  if (error.code === PG_UNIQUE_VIOLATION) {
    return "That value has to be unique, and something already uses it.";
  }
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
    return "You do not have permission to change that.";
  }

  return error.message;
}
