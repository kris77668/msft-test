import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/seo/json-ld";
import { organisationSchema } from "@/lib/seo/structured-data";
import { getSiteSettings } from "@/lib/site/settings";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.msfairytale.com.au"
  ),
  title: {
    default: "Ms Fairy Tale — Haute Couture Bridal & Evening Wear, Sydney",
    template: "%s · Ms Fairy Tale",
  },
  description:
    "Bespoke wedding gowns made to measure, and ready-to-wear evening pieces. Hand-finished in Sydney.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  return (
    <html
      lang="en-AU"
      className={`${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="bg-cream text-mocha flex min-h-full flex-col">
        {/* Organisation / LocalBusiness, once for the whole site. Every other
            schema block references it by @id rather than repeating it. */}
        <JsonLd data={organisationSchema(settings)} />
        {children}
      </body>
    </html>
  );
}
