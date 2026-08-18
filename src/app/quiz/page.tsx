import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { getProducts } from "@/lib/products/queries";
import { isBespoke } from "@/lib/products/types";
import { StyleQuiz } from "./style-quiz";

export const metadata: Metadata = {
  title: "Find Your Gown",
  description:
    "Five questions, two minutes. A starting point for your bespoke wedding gown — silhouette, fabric and feeling.",
  alternates: { canonical: "/quiz" },
};

export const revalidate = 3600;

export default async function QuizPage() {
  const gowns = (await getProducts({ kinds: ["bespoke"], limit: 50 })).filter(isBespoke);

  return (
    <>
      <Nav />
      <main className="bg-paper flex-1">
        <StyleQuiz
          gowns={gowns.map((gown) => ({
            slug: gown.slug,
            name: gown.name,
            imagePath: gown.images[0]?.path ?? null,
            imageAlt: gown.images[0]?.alt ?? gown.name,
            priceFromCents: gown.priceFromCents,
            silhouette: gown.facets.find((f) => f.facetKey === "silhouette")?.value ?? null,
          }))}
        />
      </main>
      <Footer />
    </>
  );
}
