import { createStaticSupabase } from "@/lib/supabase/static";

/**
 * Bookable slots.
 *
 * Goes through the `get_available_slots` RPC rather than querying tables
 * directly: whether a slot is taken lives in `consultations`, which is not
 * publicly readable — otherwise anyone with the public key could enumerate
 * customer names, emails and wedding dates. The function is SECURITY DEFINER and
 * returns times only.
 */

export const SYDNEY = "Australia/Sydney";

export interface Slot {
  slotId: string;
  startsAt: string;
  durationMinutes: number;
}

export interface SlotDay {
  /** YYYY-MM-DD as Sydney sees it — the grouping key for the date strip. */
  dateKey: string;
  weekday: string;
  dayOfMonth: string;
  month: string;
  slots: Slot[];
}

export async function getAvailableSlots(daysAhead = 60): Promise<SlotDay[]> {
  const supabase = createStaticSupabase();

  const { data, error } = await supabase.rpc("get_available_slots", {
    from_ts: new Date().toISOString(),
    to_ts: new Date(Date.now() + daysAhead * 86_400_000).toISOString(),
  });

  if (error) throw new Error(`getAvailableSlots failed: ${error.message}`);

  const rows = (data ?? []) as { slot_id: string; starts_at: string; duration_minutes: number }[];

  // Group by Sydney calendar date. Grouping by the UTC date would split a single
  // Sydney day across two headings for any slot after 10am local — the same
  // class of bug the prototype shipped.
  const byDate = new Map<string, SlotDay>();

  for (const row of rows) {
    const date = new Date(row.starts_at);
    const dateKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: SYDNEY,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);

    let day = byDate.get(dateKey);
    if (!day) {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-AU", {
          timeZone: SYDNEY,
          weekday: "short",
          day: "numeric",
          month: "short",
        })
          .formatToParts(date)
          .map((p) => [p.type, p.value])
      );

      day = {
        dateKey,
        weekday: parts.weekday ?? "",
        dayOfMonth: parts.day ?? "",
        month: parts.month ?? "",
        slots: [],
      };
      byDate.set(dateKey, day);
    }

    day.slots.push({
      slotId: row.slot_id,
      startsAt: row.starts_at,
      durationMinutes: row.duration_minutes,
    });
  }

  return [...byDate.values()];
}

/** "1:00 pm" — always with a meridiem, in Sydney time. */
export function formatSlotTime(startsAt: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startsAt));
}

/** "Tuesday 21 July 2026, 1:00 pm" — for confirmations and emails. */
export function formatSlotFull(startsAt: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(startsAt));
}
