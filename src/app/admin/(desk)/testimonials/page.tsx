import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPhotoLibrary } from "@/lib/admin/photo-library";
import { Field, TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Pill, SubmitButton, DangerSubmit } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveTestimonial, deleteTestimonial } from "./actions";

export const metadata: Metadata = { title: "Testimonials" };

interface Testimonial {
  id: string;
  quote: string;
  author: string;
  meta: string | null;
  rating: number | null;
  image_path: string | null;
  status: "pending" | "approved" | "rejected";
  position: number;
  is_placeholder: boolean;
  is_consented: boolean;
}

export default async function TestimonialsPage() {
  await requireAdmin();
  const db = createAdminClient();

  const [{ data, error }, photoLibrary] = await Promise.all([
    db
      .from("testimonials")
      .select(
        "id, quote, author, meta, rating, image_path, status, position, is_placeholder, is_consented"
      )
      .order("position"),
    listPhotoLibrary(),
  ]);

  const testimonials = (data ?? []) as Testimonial[];
  const placeholders = testimonials.filter((t) => t.is_placeholder).length;

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="A testimonial only appears on the site once it is approved, no longer marked as example copy, and the client has agreed to it being published."
      />

      {placeholders > 0 && (
        <div className="border-gold bg-gold-tint mb-8 border-l-2 p-5">
          <p className="eyebrow text-gold-text">
            {placeholders} example {placeholders === 1 ? "testimonial" : "testimonials"}
          </p>
          <p className="mt-2 max-w-[70ch] text-sm">
            These came from the design mock-up and are not real clients. They are hidden from
            customers. Replace them with genuine quotes, or delete them — publishing invented
            endorsements is misleading conduct under Australian Consumer Law.
          </p>
        </div>
      )}

      {error && (
        <Notice tone="error" size="sm" className="mb-6">
          Could not load testimonials: {error.message}
        </Notice>
      )}

      <datalist id="photo-library">
        {photoLibrary.map((photoPath) => (
          <option key={photoPath} value={photoPath} />
        ))}
      </datalist>

      <details className="border-rule mb-10 border">
        <summary className="eyebrow bg-paper cursor-pointer px-4 py-3">Add a testimonial</summary>
        <div className="p-5">
          <ActionForm action={saveTestimonial} successMessage>
            <TestimonialFields />
            <div className="mt-5">
              <SubmitButton>Add testimonial</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>

      {testimonials.length === 0 ? (
        <p className="text-dusty-text text-sm">No testimonials yet.</p>
      ) : (
        <div className="space-y-3">
          {testimonials.map((testimonial) => (
            <details key={testimonial.id} className="border-rule border">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 truncate">
                  <span className="font-medium">{testimonial.author}</span>
                  <span className="text-dusty-text"> — “{testimonial.quote.slice(0, 60)}…”</span>
                </span>
                {testimonial.is_placeholder && <Pill tone="warn">Example</Pill>}
                {testimonial.status === "approved" && !testimonial.is_placeholder ? (
                  <Pill tone="live">Live</Pill>
                ) : (
                  <Pill tone="draft">
                    {testimonial.status === "rejected" ? "Rejected" : "Not live"}
                  </Pill>
                )}
              </summary>

              <div className="border-softrule border-t p-5">
                <ActionForm action={saveTestimonial} successMessage>
                  <input type="hidden" name="id" value={testimonial.id} />
                  <TestimonialFields testimonial={testimonial} />
                  <div className="mt-5">
                    <SubmitButton />
                  </div>
                </ActionForm>

                <ActionForm action={deleteTestimonial} className="border-softrule mt-5 border-t pt-4">
                  <input type="hidden" name="id" value={testimonial.id} />
                  <DangerSubmit confirmMessage={`Delete the testimonial from ${testimonial.author}?`}>
                    Delete this testimonial
                  </DangerSubmit>
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

function TestimonialFields({ testimonial }: { testimonial?: Testimonial }) {
  return (
    <>
      <TextAreaField
        label="Quote"
        name="quote"
        defaultValue={testimonial?.quote ?? ""}
        required
        rows={4}
        hint="In the client's own words, without the surrounding quotation marks"
      />

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Name" name="author" defaultValue={testimonial?.author ?? ""} required />
        <Field
          label="Occasion"
          name="meta"
          defaultValue={testimonial?.meta ?? ""}
          hint="e.g. Married at Palm Beach · Summer 2025"
        />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Field
          label="Rating"
          name="rating"
          type="number"
          min={1}
          max={5}
          defaultValue={testimonial?.rating ?? ""}
          hint="1–5, or blank"
        />
        <Field
          label="Order"
          name="position"
          type="number"
          min={0}
          defaultValue={testimonial?.position ?? 0}
          hint="Lower shows first"
        />
        <Field
          label="Photograph"
          name="image_path"
          defaultValue={testimonial?.image_path ?? ""}
          list="photo-library"
          placeholder="/images/fashion/…"
        />
      </div>

      <fieldset className="mt-5">
        <legend className="eyebrow text-dusty-text mb-2">Status</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["pending", "Not yet reviewed"],
              ["approved", "Approved — show on the site"],
              ["rejected", "Rejected"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="status"
                value={value}
                defaultChecked={(testimonial?.status ?? "pending") === value}
                className="accent-mocha size-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border-softrule mt-5 space-y-3 border-t pt-4">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="is_consented"
            defaultChecked={testimonial?.is_consented ?? false}
            className="accent-mocha mt-0.5 size-4"
          />
          <span>
            They agreed to this being published
            <span className="text-dusty-text block text-xs">
              Required before it can go live, and before their rating counts towards the star
              rating shown in Google.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="is_placeholder"
            defaultChecked={testimonial?.is_placeholder ?? false}
            className="accent-mocha mt-0.5 size-4"
          />
          <span>
            This is example copy, not a real client
            <span className="text-dusty-text block text-xs">
              Keeps it hidden from customers no matter what its status says.
            </span>
          </span>
        </label>
      </div>
    </>
  );
}
