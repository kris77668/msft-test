/**
 * Site navigation — the only place link text and ordering live.
 *
 * Editing a menu label or reordering items happens here, not inside a component.
 * `href` is typed as a template literal so a typo like "/shopp" is a build error
 * rather than a link that silently 404s in production.
 */

export interface NavLink {
  href: `/${string}`;
  label: string;
}

/** Header. First three render left of the wordmark, the rest to the right. */
export const PRIMARY_NAV: readonly NavLink[] = [
  { href: "/bespoke", label: "Bridal" },
  { href: "/shop", label: "Evening" },
  { href: "/gallery", label: "Gallery" },
  { href: "/journal", label: "Real Weddings" },
  { href: "/atelier", label: "Atelier" },
  { href: "/contact", label: "Visit" },
];

export interface FooterColumn {
  heading: string;
  links: readonly NavLink[];
}

/**
 * Footer columns.
 *
 * Every link resolves to a real page. The prototype had twelve links pointing at
 * five destinations — "Accessories", "New Arrivals" and "Gift Cards" all went to
 * bare /shop, and "Contact" went to the booking page. Don't add a link here
 * until the page exists.
 */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: "Shop",
    links: [
      { href: "/shop", label: "Evening Wear" },
      { href: "/gallery", label: "Gallery" },
      { href: "/cart", label: "Your Bag" },
    ],
  },
  {
    heading: "Bespoke",
    links: [
      { href: "/bespoke", label: "The Gown Gallery" },
      { href: "/consultation", label: "Book a Consultation" },
      { href: "/quiz", label: "Find Your Gown" },
    ],
  },
  {
    heading: "Client Care",
    links: [
      { href: "/faq", label: "FAQ & Size Guide" },
      { href: "/journal", label: "Real Weddings" },
      { href: "/contact", label: "Contact" },
      { href: "/shipping-returns", label: "Shipping & Returns" },
    ],
  },
];

/** Legal pages. Required before taking payments; content is lawyer-supplied. */
export const LEGAL_LINKS: readonly NavLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/** The single call-to-action repeated across mobile menu and CTA bands. */
export const PRIMARY_CTA = {
  href: "/consultation",
  label: "Book a Consultation",
} as const satisfies NavLink;
