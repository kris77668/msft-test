import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Consultation slot grouping and formatting, in Sydney time.
 *
 * This is the exact bug class the prototype shipped: grouping by the UTC date
 * splits a single Sydney evening across two day headings, and deriving a UTC
 * date string from a Sydney date shifts a booking to the wrong day. The tests
 * pin one winter (AEST, +10) and one summer (AEDT, +11) fixture so the offset —
 * and daylight saving — are both exercised.
 *
 * Assertions avoid the exact separator of `Intl` full-date output (it varies by
 * ICU version) and check the stable parts: the YYYY-MM-DD grouping key and the
 * presence of the Sydney-local time.
 */

let mockRows: { slot_id: string; starts_at: string; duration_minutes: number }[] = [];

vi.mock("@/lib/supabase/static", () => ({
  createStaticSupabase: () => ({
    rpc: vi.fn().mockImplementation(async () => ({ data: mockRows, error: null })),
  }),
}));

import { getAvailableSlots, formatSlotTime, formatSlotFull } from "./slots";

beforeEach(() => {
  mockRows = [];
});

describe("getAvailableSlots grouping", () => {
  it("groups two slots on the same Sydney day under one date", async () => {
    // Both are 21 July 2026 in Sydney (AEST, +10): 00:30Z → 10:30, 04:00Z → 14:00.
    mockRows = [
      { slot_id: "a", starts_at: "2026-07-21T00:30:00Z", duration_minutes: 60 },
      { slot_id: "b", starts_at: "2026-07-21T04:00:00Z", duration_minutes: 60 },
    ];

    const days = await getAvailableSlots();
    expect(days).toHaveLength(1);
    expect(days[0]!.dateKey).toBe("2026-07-21");
    expect(days[0]!.slots.map((s) => s.slotId)).toEqual(["a", "b"]);
  });

  it("rolls a late-UTC slot into the following Sydney day (AEST, +10)", async () => {
    // 14:00Z on the 21st is 00:00 on the 22nd in Sydney — grouping by UTC date
    // would wrongly file it under the 21st.
    mockRows = [
      { slot_id: "morning", starts_at: "2026-07-21T00:30:00Z", duration_minutes: 60 },
      { slot_id: "rollover", starts_at: "2026-07-21T14:00:00Z", duration_minutes: 60 },
    ];

    const days = await getAvailableSlots();
    const keys = days.map((d) => d.dateKey);
    expect(keys).toContain("2026-07-21");
    expect(keys).toContain("2026-07-22");
    expect(days.find((d) => d.dateKey === "2026-07-22")!.slots[0]!.slotId).toBe("rollover");
  });

  it("applies the summer offset (AEDT, +11)", async () => {
    // 13:30Z on 15 Jan is 00:30 on the 16th in Sydney during daylight saving.
    mockRows = [{ slot_id: "s", starts_at: "2026-01-15T13:30:00Z", duration_minutes: 60 }];

    const days = await getAvailableSlots();
    expect(days[0]!.dateKey).toBe("2026-01-16");
  });
});

describe("formatSlotTime", () => {
  it("renders the Sydney-local time with a meridiem (AEST)", () => {
    // 00:30Z + 10h = 10:30 in Sydney.
    const out = formatSlotTime("2026-07-21T00:30:00Z");
    expect(out).toContain("10:30");
    expect(out).toMatch(/[ap]\.?m\.?/i);
  });
});

describe("formatSlotFull", () => {
  it("renders the Sydney date and time (AEST)", () => {
    const out = formatSlotFull("2026-07-21T00:30:00Z");
    expect(out).toContain("21 July 2026");
    expect(out).toContain("10:30");
  });

  it("uses the summer offset for a January slot (AEDT)", () => {
    // 13:30Z + 11h = 00:30 on 16 Jan in Sydney.
    const out = formatSlotFull("2026-01-15T13:30:00Z");
    expect(out).toContain("16 January 2026");
    expect(out).toContain("12:30");
  });
});
