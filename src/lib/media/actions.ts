"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { getR2Config, putImage } from "@/lib/media/r2";

/**
 * Image upload.
 *
 * The browser resizes and re-encodes to WebP before calling this (see
 * `photo-upload-field.tsx`), which keeps the request body small enough for a
 * serverless function and controls the stored size. This still validates type
 * and size because a client cannot be trusted — a hand-crafted request could
 * send anything.
 *
 * Admin-gated first, like every other write: a server action is a public
 * endpoint with a generated name, so authorisation cannot be assumed from where
 * it is called.
 */

// The client sends a resized WebP, comfortably under a serverless body limit.
// The cap is a guard against a crafted request, not the normal path.
const MAX_BYTES = 2_000_000;

const ALLOWED = new Map<string, string>([
  ["image/webp", "webp"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/avif", "avif"],
]);

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadPhoto(formData: FormData): Promise<UploadResult> {
  await requireAdmin();

  const config = getR2Config();
  if (!config) {
    return {
      ok: false,
      error:
        "Photo upload is not set up yet — add the R2 keys in Netlify. In the meantime you can type an image path.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image was selected." };
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return { ok: false, error: "That is not an image we can use (JPG, PNG, WebP or AVIF)." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That image is too large even after resizing. Try a smaller photo." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `${randomUUID()}.${ext}`;

  try {
    const url = await putImage(config, key, bytes, file.type);
    return { ok: true, url };
  } catch {
    return { ok: false, error: "The image could not be uploaded. Please try again." };
  }
}
