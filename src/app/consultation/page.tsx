import type { Metadata } from "next";
import { Nav } from "@/components/chrome/nav";
import { Footer } from "@/components/chrome/footer";
import { getAvailableSlots } from "@/lib/consultation/slots";
import { createStaticSupabase } from "@/lib/supabase/static";
import { BookingWizard } from "./booking-wizard";

export const metadata: Metadata = {
  title: "Book a Consultation",
  description:
    "Private bridal and evening consultations in Sydney, Tuesday to Saturday. One hour with the maker of your gown.",
};

export const dynamic = "force-dynamic";

/**
 * Consultation booking.
 *
 * Dynamic rather than cached: availability changes as people book, and showing a
 * stale calendar means offering times that are already gone.
 */
export default async function ConsultationPage() {
  const supabase = createStaticSupabase();

  const [days, { data: types }] = await Promise.all([
    getAvailableSlots(60),
    supabase
      .from("consultation_types")
      .select("key, label, description, deposit_cents")
      .eq("is_active", true)
      .order("position"),
  ]);

  return (
    <>
      <Nav />
      <main className="bg-paper flex-1 px-5 py-12 md:px-8">
        <div className="mx-auto max-w-[760px]">
          <header className="text-center">
            <p className="eyebrow text-dusty-text">By appointment</p>
            <h1 className="font-display mt-4 text-4xl font-light md:text-5xl">
              Book a <em className="italic">consultation</em>
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm opacity-80">
              One hour, one-on-one, with the maker of your gown. Tuesday to
              Saturday.
            </p>
          </header>

          <BookingWizard
            days={days}
            types={(types ?? []) as {
              key: string;
              label: string;
              description: string;
              deposit_cents: number;
            }[]}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
