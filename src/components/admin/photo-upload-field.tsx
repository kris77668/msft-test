"use client";

import { useRef, useState } from "react";
import { Field } from "@/components/ui/field";
import { uploadPhoto } from "@/lib/media/actions";

/**
 * A photo field that can either take a typed path or upload a new image.
 *
 * The typed path is kept on purpose: the existing `/images/fashion/*` files are
 * still referenced that way, and typing a path is the fallback before R2 is
 * configured. Uploading resizes and re-encodes to WebP in the browser — which
 * keeps the request small and the stored file light, and sidesteps the
 * serverless request-body limit a raw phone photo would blow — then sends it to
 * the admin-gated `uploadPhoto` and drops the returned URL into the same field
 * the form submits. Nothing downstream changes: the server still stores a path
 * string, whether typed or uploaded.
 */

// Large enough for a full-bleed card, small enough that the WebP stays well
// under the upload limit.
const MAX_EDGE = 1600;

export function PhotoUploadField({
  name,
  label,
  defaultValue = "",
  required = false,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(undefined);
    try {
      const webp = await resizeToWebp(file, MAX_EDGE);
      const body = new FormData();
      body.set("file", webp, "upload.webp");
      const result = await uploadPhoto(body);
      if (result.ok) {
        setValue(result.url);
      } else {
        setError(result.error);
      }
    } catch {
      setError("That image could not be prepared in the browser. Try a different file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <Field
        label={label}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        list="photo-library"
        required={required}
        hint={hint}
        placeholder="/images/fashion/… — or upload below"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="eyebrow border-rule hover:border-mocha min-h-11 cursor-pointer border px-4 py-2 transition-colors disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload a photo"}
        </button>
        {value && !busy && <span className="text-dusty-text text-xs">Attached</span>}
      </div>

      {error && (
        <p role="alert" className="text-error mt-1.5 text-xs">
          {error}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

/**
 * Resize to fit [maxEdge] and re-encode as WebP, entirely in the browser.
 *
 * `createImageBitmap(..., { imageOrientation: "from-image" })` bakes in EXIF
 * orientation, so a photo taken sideways on a phone is stored upright rather
 * than rotated — the canvas would otherwise ignore the EXIF flag and save it on
 * its side.
 */
async function resizeToWebp(file: File, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82)
  );
  if (!blob) throw new Error("encode failed");
  return new File([blob], "upload.webp", { type: "image/webp" });
}
