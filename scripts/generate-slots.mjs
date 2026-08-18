/**
 * Generates consultation availability slots.
 *
 * Appointments are Tuesday–Saturday, one hour, at Sydney local times. Stored as
 * UTC instants (timestamptz), so DST transitions in October and April are
 * handled by the conversion rather than by adding a fixed offset.
 *
 * This is the bug the prototype had: it built slot keys with
 * `d.toISOString().slice(0,10)` from a Sydney-local Date. Sydney is UTC+10/+11,
 * so every slot generated after 10am local landed on the WRONG CALENDAR DAY. Its
 * times were also bare strings with no AM/PM ('10:00','11:30','1:00'), so a
 * bride could book "1:00" and arrive at one in the morning.
 *
 * Run: node --env-file=.env.local scripts/generate-slots.mjs [days]
 */

const ZONE = "Australia/Sydney";
const LOCAL_TIMES = ["10:00", "11:30", "13:00", "14:30", "16:00"];
const WEEKDAYS = [2, 3, 4, 5, 6]; // Tue–Sat, per the atelier's hours
const DAYS_AHEAD = Number(process.argv[2] ?? 90);

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;

/**
 * Converts a wall-clock time in `tz` to the correct UTC instant.
 *
 * Works by asking what a guessed UTC instant looks like in the target zone, then
 * correcting by the difference. Handles both standard and daylight offsets
 * without hardcoding either.
 */
function zonedToUtc(year, month, day, hour, minute, tz) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value])
  );

  const asZoned = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute)
  );

  return new Date(guess - (asZoned - guess));
}

/** The weekday of a UTC instant, as seen in the target zone. */
function zonedWeekday(date, tz) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

const slots = [];
const today = new Date();

for (let offset = 1; offset <= DAYS_AHEAD; offset++) {
  const day = new Date(today);
  day.setUTCDate(day.getUTCDate() + offset);

  // Read the calendar date as Sydney sees it, not as UTC does.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(day)
      .map((p) => [p.type, p.value])
  );

  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);

  for (const time of LOCAL_TIMES) {
    const [hh, mm] = time.split(":").map(Number);
    const instant = zonedToUtc(y, m, d, hh, mm, ZONE);
    if (!WEEKDAYS.includes(zonedWeekday(instant, ZONE))) continue;
    slots.push({ starts_at: instant.toISOString(), duration_minutes: 60 });
  }
}

// Deduplicate — overlapping day windows can produce the same instant twice.
const unique = [...new Map(slots.map((s) => [s.starts_at, s])).values()];

const res = await fetch(`${URL_}/rest/v1/availability_slots`, {
  method: "POST",
  headers: {
    apikey: SECRET,
    Authorization: `Bearer ${SECRET}`,
    "Content-Type": "application/json",
    // starts_at is UNIQUE; ignore ones that already exist so re-running is safe.
    Prefer: "resolution=ignore-duplicates,return=minimal",
  },
  body: JSON.stringify(unique),
});

if (!res.ok) {
  console.error("Failed:", res.status, await res.text());
  process.exit(1);
}

const fmt = new Intl.DateTimeFormat("en-AU", {
  timeZone: ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

console.log(`Generated ${unique.length} slots over ${DAYS_AHEAD} days (Tue–Sat).`);
console.log("First few, rendered in Sydney local time:");
for (const slot of unique.slice(0, 5)) {
  console.log(`  ${slot.starts_at}  ->  ${fmt.format(new Date(slot.starts_at))}`);
}
