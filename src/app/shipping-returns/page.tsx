import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  robots: { index: false, follow: true },
};

export default function ShippingReturnsPage() {
  return (
    <LegalPage
      title="Shipping & Returns"
      crumbLabel="Shipping & Returns"
      sections={[
        "Delivery timeframes: made-to-order evening wear ships in 8–10 weeks",
        "Shipping within Australia — currently the only region served",
        "Insurance and tracking",
        "That made-to-order pieces are final sale, and why",
        "Returns on in-stock accessories, and the window for them",
        "Faulty or misdescribed goods under Australian Consumer Law",
        "Alterations after delivery, and what they cost",
        "How to start a return or raise a problem",
      ]}
    />
  );
}
