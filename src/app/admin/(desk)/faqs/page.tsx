import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Field, TextAreaField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Pill, SubmitButton, DangerSubmit } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveFaq, deleteFaq } from "./actions";

export const metadata: Metadata = { title: "FAQs" };

interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  position: number;
  is_published: boolean;
}

/**
 * FAQs, edited in place.
 *
 * Each question is its own form inside a collapsed <details>. That keeps the
 * page scannable while avoiding a separate edit route for what is three fields,
 * and <details> gives keyboard and screen-reader behaviour for free.
 *
 * `position` orders questions within a category on the public page; categories
 * themselves appear in the order their first question does.
 */
export default async function FaqsPage() {
  await requireAdmin();
  const db = createAdminClient();

  const { data, error } = await db
    .from("faqs")
    .select("id, category, question, answer, position, is_published")
    .order("category")
    .order("position");

  const faqs = (data ?? []) as Faq[];
  const categories = [...new Set(faqs.map((faq) => faq.category))];

  const grouped = categories.map((category) => ({
    category,
    items: faqs.filter((faq) => faq.category === category),
  }));

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Shown on the FAQ page, grouped by category. Unpublished questions stay hidden from customers."
      />

      {error && (
        <Notice tone="error" size="sm" className="mb-6">
          Could not load the questions: {error.message}
        </Notice>
      )}

      <datalist id="faq-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {/* ── Add ────────────────────────────────────────────────────── */}
      <details className="border-rule mb-10 border">
        <summary className="eyebrow bg-paper cursor-pointer px-4 py-3">Add a question</summary>
        <div className="p-5">
          <ActionForm action={saveFaq} successMessage>
            <FaqFields />
            <div className="mt-5">
              <SubmitButton>Add question</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>

      {/* ── Existing ───────────────────────────────────────────────── */}
      {grouped.length === 0 ? (
        <p className="text-dusty-text text-sm">No questions yet.</p>
      ) : (
        grouped.map(({ category, items }) => (
          <section key={category} className="mb-10">
            <h2 className="eyebrow text-dusty-text border-softrule border-b pb-2">{category}</h2>

            <div className="mt-4 space-y-3">
              {items.map((faq) => (
                <details key={faq.id} className="border-rule border">
                  <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                    <span className="flex-1">{faq.question}</span>
                    {faq.is_published ? (
                      <Pill tone="live">Live</Pill>
                    ) : (
                      <Pill tone="draft">Hidden</Pill>
                    )}
                  </summary>

                  <div className="border-softrule border-t p-5">
                    <ActionForm action={saveFaq} successMessage>
                      <input type="hidden" name="id" value={faq.id} />
                      <FaqFields faq={faq} />
                      <div className="mt-5">
                        <SubmitButton />
                      </div>
                    </ActionForm>

                    <ActionForm action={deleteFaq} className="border-softrule mt-5 border-t pt-4">
                      <input type="hidden" name="id" value={faq.id} />
                      <DangerSubmit confirmMessage={`Delete "${faq.question}"?`}>
                        Delete this question
                      </DangerSubmit>
                    </ActionForm>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

function FaqFields({ faq }: { faq?: Faq }) {
  return (
    <>
      <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
        <Field
          label="Category"
          name="category"
          defaultValue={faq?.category ?? ""}
          list="faq-categories"
          required
          hint="Pick an existing group or type a new one"
        />
        <Field
          label="Order"
          name="position"
          type="number"
          min={0}
          defaultValue={faq?.position ?? 0}
          hint="Lower shows first"
        />
      </div>

      <Field
        label="Question"
        name="question"
        defaultValue={faq?.question ?? ""}
        required
        className="mt-5"
      />

      <TextAreaField
        label="Answer"
        name="answer"
        defaultValue={faq?.answer ?? ""}
        required
        rows={5}
        className="mt-5"
      />

      <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={faq?.is_published ?? true}
          className="accent-mocha size-4"
        />
        Show this question to customers
      </label>
    </>
  );
}
