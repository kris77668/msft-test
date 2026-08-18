import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The photographs available to attach to a gown.
 *
 * A convenience for the path field: it offers the images the site already knows
 * about, so the atelier can pick one instead of typing a path from memory and
 * finding out it was wrong when the page renders a broken image. New photos are
 * uploaded through `PhotoUploadField` (to Cloudflare R2 — see `lib/media`),
 * which drops the returned URL straight into the field; this list is the
 * fallback and the picker, not the upload path.
 *
 * Two sources, unioned:
 *
 *   1. Distinct `product_images.path` values — every photo currently in use,
 *      whether a local `/images/*` asset or an uploaded R2 URL. Always available.
 *   2. A directory read of `public/images/fashion`. Catches local files that
 *      are deployed but not yet attached to anything. Freshly uploaded R2 images
 *      are NOT on local disk, so they do not appear here — they surface via (1)
 *      once attached to a gown.
 *
 * The directory read is best-effort on purpose. On a serverless host the public
 * folder is served by the CDN and is not necessarily present in the function
 * bundle, so this throws in production and returns nothing. That is a degraded
 * list, not a broken page, which is why the form also accepts a typed path.
 */
export async function listPhotoLibrary(): Promise<string[]> {
  const [fromDb, fromDisk] = await Promise.all([pathsInUse(), pathsOnDisk()]);
  return [...new Set([...fromDb, ...fromDisk])].sort();
}

async function pathsInUse(): Promise<string[]> {
  const db = createAdminClient();
  const { data } = await db.from("product_images").select("path");
  return (data ?? []).map((row) => String(row.path));
}

async function pathsOnDisk(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), "public", "images", "fashion");
    const files = await readdir(dir);
    return files
      .filter((file) => /\.(jpe?g|png|webp|avif)$/i.test(file))
      .map((file) => `/images/fashion/${file}`);
  } catch {
    return [];
  }
}
