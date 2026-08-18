"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Field, TextAreaField } from "@/components/ui/field";
import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton, DangerSubmit } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import type { ActionResult } from "@/lib/admin/result";
import { saveProduct, deleteProduct } from "./actions";

export type Kind = "rtw" | "accessory" | "bespoke";

export interface ProductFormValues {
  id?: string;
  kind: Kind;
  status: "draft" | "published" | "archived";
  name: string;
  slug: string;
  description: string;
  lead_time_note: string;
  badge: string;
  colour: string;
  seo_title: string;
  seo_description: string;
  price: string;
  price_from: string;
  price_to: string;
  sizes: { label: string; in_stock: boolean }[];
  images: { path: string; alt: string }[];
}

/**
 * The gown form.
 *
 * The two-path rule is enforced by rendering, not by validation: when kind is
 * bespoke there is no price field and no size list in the DOM at all, so there
 * is nothing to leave stale and nothing to submit by accident. The server
 * rebuilds the pricing columns from the kind regardless (see actions.ts) —
 * this is the humane layer, not the safe one.
 */
export function ProductForm({
  initial,
  photoLibrary,
}: {
  initial: ProductFormValues;
  photoLibrary: string[];
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(saveProduct, null);
  const [kind, setKind] = useState<Kind>(initial.kind);
  // Rows carry a stable `uid` used only as their React key. Keying on the array
  // index instead lets an uncontrolled input keep a *deleted* row's text: React
  // reuses DOM nodes by key and `defaultValue` only applies on mount, so
  // removing any row but the last shifts every value below it into the wrong
  // row and saves it. A stable key unmounts exactly the removed row.
  const [sizes, setSizes] = useState(() =>
    (initial.sizes.length > 0 ? initial.sizes : [{ label: "", in_stock: true }]).map(
      (size, i) => ({ ...size, uid: `s${i}` })
    )
  );
  const [images, setImages] = useState(() =>
    (initial.images.length > 0 ? initial.images : [{ path: "", alt: "" }]).map((image, i) => ({
      ...image,
      uid: `i${i}`,
    }))
  );
  // Monotonic source for keys of rows added after mount. Never reused, and the
  // `-new-` prefix keeps it clear of the `s0`/`i0` initial keys above.
  const nextUid = useRef(0);

  const isBespoke = kind === "bespoke";

  return (
    <>
      <form action={formAction} className="space-y-10">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}

        {/* ── What kind of gown ─────────────────────────────────────── */}
        <section>
          <SectionTitle>The piece</SectionTitle>

          <fieldset className="mt-4">
            <legend className="eyebrow text-dusty-text mb-2">Type</legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["bespoke", "Bridal — bespoke"],
                  ["rtw", "Evening — ready to wear"],
                  ["accessory", "Accessory"],
                ] as [Kind, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={
                    kind === value
                      ? "border-mocha bg-paper eyebrow cursor-pointer border px-4 py-3"
                      : "border-rule hover:border-mocha eyebrow cursor-pointer border px-4 py-3 transition-colors"
                  }
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-dusty-text mt-2 text-xs">
              {isBespoke
                ? "Bespoke gowns show a price range, take consultation bookings, and never appear in a cart."
                : "Ready-to-wear pieces show one price, offer sizes, and can be bought online."}
            </p>
          </fieldset>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Name" name="name" defaultValue={initial.name} required />
            <Field
              label="Web address"
              name="slug"
              defaultValue={initial.slug}
              required
              hint={`msfairytale.com.au/${isBespoke ? "bespoke" : "product"}/…`}
            />
          </div>

          <TextAreaField
            label="Description"
            name="description"
            defaultValue={initial.description}
            className="mt-5"
            rows={5}
          />

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field
              label="Lead time note"
              name="lead_time_note"
              defaultValue={initial.lead_time_note}
              hint={isBespoke ? "e.g. 8–12 months" : "e.g. Ships in 8–10 weeks"}
            />
            <Field
              label="Badge"
              name="badge"
              defaultValue={initial.badge}
              hint="New, Bestseller, Signature — or leave blank"
            />
          </div>

          {!isBespoke && (
            <Field
              label="Colour"
              name="colour"
              defaultValue={initial.colour}
              className="mt-5"
              hint="Blush, Ivory, Midnight…"
            />
          )}
        </section>

        {/* ── Price ─────────────────────────────────────────────────── */}
        <section>
          <SectionTitle>Price</SectionTitle>

          {isBespoke ? (
            <>
              <p className="text-dusty-text mt-2 text-xs">
                Shown as “Investment from …”. A commission never displays a single fixed price.
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <Field
                  label="From"
                  name="price_from"
                  defaultValue={initial.price_from}
                  inputMode="decimal"
                  required
                  hint="In dollars, e.g. 4800"
                />
                <Field
                  label="To"
                  name="price_to"
                  defaultValue={initial.price_to}
                  inputMode="decimal"
                  required
                  hint="In dollars, e.g. 6200"
                />
              </div>
            </>
          ) : (
            <Field
              label="Price"
              name="price"
              defaultValue={initial.price}
              inputMode="decimal"
              required
              className="mt-4 max-w-[260px]"
              hint="In dollars, GST included. e.g. 2400"
            />
          )}
        </section>

        {/* ── Sizes ─────────────────────────────────────────────────── */}
        {!isBespoke && (
          <section>
            <SectionTitle>Sizes</SectionTitle>
            <p className="text-dusty-text mt-2 text-xs">
              Untick a size to show it as sold out. Remove it to hide it entirely.
            </p>

            <div className="mt-4 space-y-3">
              {sizes.map((size, index) => (
                <div key={size.uid} className="flex flex-wrap items-end gap-3">
                  <Field
                    label={index === 0 ? "Size" : ""}
                    name="size_label"
                    defaultValue={size.label}
                    placeholder="AU 10"
                    className="w-[140px]"
                  />
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="size_in_stock"
                      value={index}
                      defaultChecked={size.in_stock}
                      className="accent-mocha size-4"
                    />
                    In stock
                  </label>
                  <button
                    type="button"
                    onClick={() => setSizes(sizes.filter((_, i) => i !== index))}
                    className="text-dusty-text hover:text-error min-h-11 cursor-pointer text-xs underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setSizes([...sizes, { uid: `s-new-${nextUid.current++}`, label: "", in_stock: true }])
              }
              className="eyebrow border-rule hover:border-mocha mt-4 cursor-pointer border px-4 py-2 transition-colors"
            >
              Add a size
            </button>
          </section>
        )}

        {/* ── Photographs ───────────────────────────────────────────── */}
        <section>
          <SectionTitle>Photographs</SectionTitle>
          <p className="text-dusty-text mt-2 text-xs">
            The first photograph is the one shown on cards and in the gallery. Every photograph
            needs a description — screen readers read it aloud, and search engines use it.
          </p>

          <datalist id="photo-library">
            {photoLibrary.map((photoPath) => (
              <option key={photoPath} value={photoPath} />
            ))}
          </datalist>

          <div className="mt-4 space-y-5">
            {images.map((image, index) => (
              <div key={image.uid} className="border-softrule border-l-2 pl-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <PhotoUploadField
                    label={index === 0 ? "File (first is the cover)" : "File"}
                    name="image_path"
                    defaultValue={image.path}
                  />
                  <Field
                    label="Description"
                    name="image_alt"
                    defaultValue={image.alt}
                    placeholder="Ivory silk gown, side view"
                  />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    className="text-dusty-text hover:text-error min-h-11 cursor-pointer text-xs underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setImages([...images, { uid: `i-new-${nextUid.current++}`, path: "", alt: "" }])
            }
            className="eyebrow border-rule hover:border-mocha mt-4 cursor-pointer border px-4 py-2 transition-colors"
          >
            Add a photograph
          </button>
        </section>

        {/* ── Search listing ────────────────────────────────────────── */}
        <section>
          <SectionTitle>Search listing</SectionTitle>
          <p className="text-dusty-text mt-2 text-xs">
            How this gown appears in Google. Leave blank to use the name and description.
          </p>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field label="Title" name="seo_title" defaultValue={initial.seo_title} />
            <Field label="Description" name="seo_description" defaultValue={initial.seo_description} />
          </div>
        </section>

        {/* ── Save ──────────────────────────────────────────────────── */}
        <section className="border-rule border-t pt-6">
          <fieldset>
            <legend className="eyebrow text-dusty-text mb-2">Visibility</legend>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["draft", "Draft — only you can see it"],
                  ["published", "Live — customers can see it"],
                  ["archived", "Archived — hidden, kept for records"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    defaultChecked={initial.status === value}
                    className="accent-mocha size-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {state && !state.ok && <Notice className="mt-5">{state.error}</Notice>}
          {state?.ok && (
            <Notice tone="quiet" className="mt-5">
              {state.message}
            </Notice>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SubmitButton>{initial.id ? "Save changes" : "Create gown"}</SubmitButton>
            <Link href="/admin/products" className="eyebrow text-dusty-text hover:text-mocha">
              Back to gowns
            </Link>
          </div>
        </section>
      </form>

      {initial.id && (
        <div className="border-rule mt-12 border-t pt-6">
          <p className="eyebrow text-dusty-text">Delete</p>
          <p className="mt-2 max-w-[60ch] text-xs opacity-70">
            Past orders keep their own copy of the name, price and photograph, so deleting will not
            affect them. Archiving is usually better — it keeps the record and simply hides it.
          </p>
          <ActionForm action={deleteProduct} className="mt-3">
            <input type="hidden" name="id" value={initial.id} />
            <DangerSubmit confirmMessage={`Delete ${initial.name}? This cannot be undone.`}>
              Delete this gown
            </DangerSubmit>
          </ActionForm>
        </div>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display border-softrule border-b pb-2 text-xl font-light">{children}</h2>;
}
