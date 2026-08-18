import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Sale",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Sale"
      crumbLabel="Terms"
      sections={[
        "Made-to-order evening wear: what is agreed at the point of purchase",
        "Bespoke commissions: that a consultation deposit is not a contract for a gown",
        "Consultation deposits — amount, what they secure, and whether they are refundable",
        "Cancellation windows for appointments, and for commissions in progress",
        "Payment terms, including instalments for a bespoke commission",
        "Australian Consumer Law guarantees, which cannot be excluded",
        "Fittings: how many are included and what happens if more are needed",
        "Limits of liability, and governing law (New South Wales)",
      ]}
    />
  );
}
