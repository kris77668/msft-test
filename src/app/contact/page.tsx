import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { Crumb } from "@/components/ui/crumb";
import { ButtonLink } from "@/components/ui/button";
import { CalendarIcon, InstagramIcon } from "@/components/ui/icons";
import { getSiteSettings, formatAddress } from "@/lib/site/settings";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Visit the Atelier",
  description:
    "Private bridal and evening consultations in Sydney. Get in touch about a commission, an alteration, or simply to talk possibilities.",
  alternates: { canonical: "/contact" },
};

export const revalidate = 3600;

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const address = formatAddress(settings);

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-10 md:px-8">
        <Crumb items={[{ label: "Home", href: "/" }, { label: "Visit" }]} />

        <header className="mt-6 max-w-xl">
          <h1 className="font-display text-4xl font-light md:text-5xl">
            Come and <em className="italic">see us</em>
          </h1>
          <p className="mt-3 text-sm opacity-80">
            For a wedding gown, book a consultation — that&apos;s where every
            commission begins. For anything else, this form reaches us directly.
          </p>
        </header>

        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_300px] md:gap-16">
          <ContactForm />

          <aside className="flex flex-col gap-8">
            <div>
              <p className="eyebrow text-dusty-text">The atelier</p>
              <p className="font-display mt-2 text-xl leading-snug font-light">
                {address ?? "Address to be confirmed"}
              </p>
              {settings.contentIsPlaceholder && (
                <p className="border-gold text-gold-text mt-3 border-l-2 py-1 pl-3 text-xs">
                  Studio details are being confirmed.
                </p>
              )}
            </div>

            <div>
              <p className="eyebrow text-dusty-text">Speak to someone</p>
              <p className="font-display mt-2 text-xl font-light">
                {settings.phone ?? "Phone to be confirmed"}
              </p>
              {settings.email && (
                <a href={`mailto:${settings.email}`} className="mt-1 flex min-h-11 items-center text-sm underline">
                  {settings.email}
                </a>
              )}
              {settings.openingHours && (
                <p className="text-dusty-text mt-2 text-xs">{settings.openingHours}</p>
              )}
            </div>

            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 text-sm underline"
              >
                <InstagramIcon size={16} /> Follow on Instagram
              </a>
            )}

            <div className="bg-paper p-5">
              <p className="font-display text-lg font-light">Planning a wedding?</p>
              <p className="mt-1.5 text-sm opacity-80">
                A consultation is one hour, one-on-one, with the maker of your gown.
              </p>
              <ButtonLink href="/consultation" variant="bespoke" size="sm" fullWidth className="mt-4">
                <CalendarIcon size={14} /> Book a Consultation
              </ButtonLink>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}
