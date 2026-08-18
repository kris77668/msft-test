import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Field } from "@/components/ui/field";
import { PageHeader, SubmitButton } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { saveSettings } from "./actions";

export const metadata: Metadata = { title: "Studio" };

interface Settings {
  studio_name: string | null;
  legal_name: string | null;
  studio_address_line: string | null;
  studio_suburb: string | null;
  studio_state: string | null;
  studio_postcode: string | null;
  studio_locality: string | null;
  phone: string | null;
  email: string | null;
  instagram_url: string | null;
  opening_hours: string | null;
  abn: string | null;
  content_is_placeholder: boolean;
}

export default async function SettingsPage() {
  await requireAdmin();
  const db = createAdminClient();

  const { data } = await db
    .from("site_settings")
    .select(
      "studio_name, legal_name, studio_address_line, studio_suburb, studio_state, " +
        "studio_postcode, studio_locality, phone, email, instagram_url, opening_hours, " +
        "abn, content_is_placeholder"
    )
    .maybeSingle();

  const settings = (data ?? { content_is_placeholder: true }) as Settings;

  return (
    <>
      <PageHeader
        title="Studio"
        description="Address, phone and hours. These appear in the footer of every page, on the contact page, and on tax invoices."
      />

      <ActionForm action={saveSettings} successMessage className="max-w-[720px]">
        <section>
          <h2 className="font-display border-softrule border-b pb-2 text-xl font-light">Name</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field
              label="Studio name"
              name="studio_name"
              defaultValue={settings.studio_name ?? ""}
              required
            />
            <Field
              label="Legal name"
              name="legal_name"
              defaultValue={settings.legal_name ?? ""}
              hint="The registered entity, if different — used on invoices"
            />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display border-softrule border-b pb-2 text-xl font-light">Address</h2>
          <Field
            label="Street"
            name="studio_address_line"
            defaultValue={settings.studio_address_line ?? ""}
            className="mt-4"
            placeholder="Studio 4, Knox Street"
          />
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <Field label="Suburb" name="studio_suburb" defaultValue={settings.studio_suburb ?? ""} />
            <Field label="State" name="studio_state" defaultValue={settings.studio_state ?? ""} />
            <Field
              label="Postcode"
              name="studio_postcode"
              defaultValue={settings.studio_postcode ?? ""}
            />
          </div>
          <Field
            label="Locality"
            name="studio_locality"
            defaultValue={settings.studio_locality ?? ""}
            className="mt-5"
            hint="How the area is named in a sentence — “our Double Bay atelier”"
          />
        </section>

        <section className="mt-10">
          <h2 className="font-display border-softrule border-b pb-2 text-xl font-light">Contact</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <Field label="Phone" name="phone" defaultValue={settings.phone ?? ""} type="tel" />
            <Field label="Email" name="email" defaultValue={settings.email ?? ""} type="email" />
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field
              label="Instagram"
              name="instagram_url"
              defaultValue={settings.instagram_url ?? ""}
              hint="Full link, starting with https://"
            />
            <Field
              label="Opening hours"
              name="opening_hours"
              defaultValue={settings.opening_hours ?? ""}
              placeholder="Mon–Sat · 10–18"
            />
          </div>
          <Field
            label="ABN"
            name="abn"
            defaultValue={settings.abn ?? ""}
            className="mt-5 max-w-[280px]"
            hint="Required on tax invoices"
          />
        </section>

        {/* ── The flag ─────────────────────────────────────────────── */}
        <section className="border-rule mt-10 border-t pt-6">
          <h2 className="font-display text-xl font-light">Before launch</h2>
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="content_is_placeholder"
              defaultChecked={settings.content_is_placeholder}
              className="accent-mocha mt-0.5 size-4"
            />
            <span>
              This site still contains placeholder content
              <span className="text-dusty-text mt-1 block max-w-[60ch] text-xs">
                While this is ticked, the site marks invented content as unconfirmed — the size
                guide in particular says it is being finalised rather than presenting numbers as
                authoritative. Untick it only once the prices, testimonials, studio details and size
                chart are all real. The phone app reads this flag too.
              </span>
            </span>
          </label>
        </section>

        <div className="mt-8">
          <SubmitButton>Save studio details</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
