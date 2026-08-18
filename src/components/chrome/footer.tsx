import Link from "next/link";
import { InstagramIcon } from "@/components/ui/icons";
import { getSiteSettings, formatAddress } from "@/lib/site/settings";
import { FOOTER_COLUMNS, LEGAL_LINKS } from "@/data/navigation";

/**
 * Site footer — ported from core.jsx's <Footer>.
 *
 * Changes from the prototype:
 *
 *  - Its twelve links resolved to five destinations; "Accessories", "New
 *    Arrivals" and "Gift Cards" all pointed at bare /shop, and "Contact" went to
 *    the consultation booking page. Only real destinations are listed here.
 *  - Legal links (privacy, terms, shipping & returns) are included because an
 *    e-commerce site cannot launch without them. The pages are scaffolded with
 *    marked placeholders for a lawyer — deliberately not drafted.
 *  - Address, phone and ABN come from `site_settings`, and are visibly marked
 *    while unconfirmed rather than silently showing an old address.
 *  - The year was computed client-side, which mismatches between server and
 *    client across midnight and in different timezones. Rendered on the server.
 */
export async function Footer() {
  const settings = await getSiteSettings();
  const address = formatAddress(settings);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-cream mt-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-16 md:px-8 md:py-20">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="eyebrow">Ms Fairy Tale</p>
            <p className="mt-5 max-w-64 text-sm opacity-70">
              Haute couture bridal and evening wear, made by hand
              {settings.locality ? ` in ${settings.locality}` : ""}.
            </p>
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm opacity-70 transition-opacity hover:opacity-100"
              >
                <InstagramIcon size={16} />
                Instagram
              </a>
            )}
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <FooterColumn key={column.heading} {...column} />
          ))}
        </div>

        <div className="border-cream/15 mt-14 border-t pt-8">
          {settings.contentIsPlaceholder && (
            <p className="border-gold text-gold mb-5 border-l-2 py-1 pl-3 text-xs">
              Studio address, phone and ABN are placeholders pending confirmation.
            </p>
          )}

          <div className="flex flex-col gap-4 text-xs opacity-70 md:flex-row md:items-center md:justify-between">
            <p>
              © {settings.studioName} {year}
              {settings.abn ? ` · ABN ${settings.abn}` : ""}
            </p>

            <p>
              {[address, settings.phone].filter(Boolean).join(" · ") ||
                "Studio details to be confirmed"}
            </p>

            <nav className="-my-2 flex gap-5" aria-label="Legal">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center hover:opacity-100"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="eyebrow opacity-60">{heading}</p>
      {/* Links are full-height flex rows rather than inline text: a 20px line of
          text is not a reliable tap target on a phone, and most traffic here
          arrives on one. */}
      <ul className="mt-3 flex flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex min-h-11 items-center text-sm opacity-70 transition-opacity hover:opacity-100"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
