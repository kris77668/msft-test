import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      crumbLabel="Privacy"
      sections={[
        "What personal information we collect (name, contact details, measurements, order and booking history)",
        "How measurements and fitting notes are stored and who can see them",
        "Payment data — handled by Stripe; card details never reach our servers",
        "Email marketing consent, and how to unsubscribe",
        "Cookies and analytics",
        "How long records are kept, and how to request deletion",
        "Compliance with the Privacy Act 1988 and the Australian Privacy Principles",
        "Who to contact about a privacy concern",
      ]}
    />
  );
}
