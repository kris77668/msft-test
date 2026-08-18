/**
 * Seeds journal posts and testimonials.
 *
 * ALL OF THIS IS PLACEHOLDER. Testimonials are inserted with
 * `is_placeholder = true` and `is_consented = false`, so the RLS policy hides
 * them from the public site and no Review structured data is emitted for them.
 * They exist to prove the templates render, not to be published.
 *
 * Publishing invented reviews, or a press quote that was never given, is
 * misleading conduct under Australian Consumer Law.
 *
 * Run: node --env-file=.env.local scripts/seed-editorial.mjs
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const headers = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

const IMG = (n) => `/images/fashion/${n}.jpg`;

const posts = [
  {
    slug: "eleanor-and-james-at-the-vineyard",
    title: "Eleanor & James, in the vineyard light",
    category: "Real Wedding",
    excerpt:
      "A garden ceremony in soft spring light, and a Chantilly-lace A-line reworked across three fittings.",
    body_mdx: `Eleanor came to us with a single photograph — her grandmother, married in 1961, in a lace gown with a high neck and the smallest covered buttons.

She did not want a copy. She wanted the feeling of it: something quiet, something that would not date, something that looked like it had always existed.

We began with French Chantilly and an A-line that skimmed rather than clung. The first toile was too formal. The second lost the neckline entirely. By the third we had it — a soft V, a lace edge that followed the collarbone, and those buttons, thirty-one of them, down the back.

The ceremony was outdoors in September. The light did exactly what she hoped it would.`,
    cover_path: IMG("wedding-dress-ms-fairy-tale-050"),
    cover_alt: "A bride in a Chantilly lace A-line gown in vineyard light",
    read_minutes: 6,
    published_at: "2026-05-12T00:00:00Z",
  },
  {
    slug: "on-choosing-fabric",
    title: "On choosing fabric",
    category: "Journal",
    excerpt:
      "Why the fabric decision matters more than the silhouette, and how to make it without seeing the finished gown.",
    body_mdx: `Most brides arrive with a silhouette in mind and no opinion about fabric. It is usually the other way around that matters.

Silhouette can be adjusted through fitting. Fabric cannot — it decides how the gown moves, how it photographs, how it feels at hour nine of a long day.

Silk crêpe is heavy and quiet. It falls straight down and holds a line. Mikado has body and holds a shape away from you, which is why it suits structured gowns. Tulle is weightless and forgiving. Charmeuse shows everything, which is either the point or the problem.

We keep swatches of everything on the table for a reason. Hold them. The decision makes itself.`,
    cover_path: IMG("fashion-boutique-gallery-09"),
    cover_alt: "Fabric swatches laid out on the atelier table",
    read_minutes: 4,
    published_at: "2026-06-02T00:00:00Z",
  },
  {
    slug: "how-long-does-a-gown-take",
    title: "How long does a gown actually take?",
    category: "Journal",
    excerpt:
      "Eight to twelve months, and an honest account of where that time goes.",
    body_mdx: `The short answer is eight to twelve months. The longer answer is that very little of that is sewing.

The first month is design — conversation, sketches, and the slow narrowing of what you actually want. Then fabric, which can take weeks to source if it is coming from Italy or France.

The toile comes next. This is the part people underestimate: a full mock-up in calico, fitted to your body, taken apart and re-cut until the line is right. It is not unusual to make two.

Only then do we cut the real fabric. Construction and hand-finishing take six to eight weeks. Three fittings follow, the last as close to the day as we sensibly can.

If your date is sooner than that, tell us anyway. We can sometimes make it work.`,
    cover_path: IMG("fashion-boutique-gallery-11"),
    cover_alt: "A gown in progress on the dress stand",
    read_minutes: 5,
    published_at: "2026-06-24T00:00:00Z",
  },
];

const testimonials = [
  {
    quote:
      "Walking in felt like stepping into a friend's studio — they listened, sketched, draped, and three fittings later I had a gown that felt entirely mine.",
    author: "Eleanor M.",
    meta: "Married at Centennial Vineyards · Spring 2025",
    rating: 5,
    image_path: IMG("fashion-boutique-gallery-01"),
    status: "approved",
    is_placeholder: true,
    is_consented: false,
    position: 0,
  },
  {
    quote:
      "They rebuilt the bodice from scratch when I changed my mind a month before the wedding. Patient, kind, extraordinary craftsmanship.",
    author: "Sophia L.",
    meta: "Married at Gunners Barracks · Winter 2024",
    rating: 5,
    image_path: IMG("fashion-boutique-gallery-03"),
    status: "approved",
    is_placeholder: true,
    is_consented: false,
    position: 1,
  },
  {
    quote:
      "Five fittings, countless cups of tea, and a gown I will keep forever. I cannot recommend them highly enough.",
    author: "Mia R.",
    meta: "Married at Bondi Icebergs · Autumn 2025",
    rating: 5,
    image_path: IMG("fashion-boutique-gallery-05"),
    status: "approved",
    is_placeholder: true,
    is_consented: false,
    position: 2,
  },
];

async function upsert(table, rows, onConflict) {
  const res = await fetch(`${URL_}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error(`${table} failed:`, res.status, await res.text());
    process.exitCode = 1;
    return;
  }
  console.log(`${table}: ${rows.length} rows`);
}

await upsert("journal_posts", posts, "slug");

// Testimonials have no natural unique key; clear the placeholder set first so
// re-running doesn't duplicate them.
await fetch(`${URL_}/rest/v1/testimonials?is_placeholder=eq.true`, {
  method: "DELETE",
  headers,
});
const res = await fetch(`${URL_}/rest/v1/testimonials`, {
  method: "POST",
  headers,
  body: JSON.stringify(testimonials),
});
console.log(res.ok ? `testimonials: ${testimonials.length} rows (hidden — placeholder)` : `testimonials failed: ${res.status}`);

console.log(
  "\nAll seeded content is PLACEHOLDER. Testimonials are flagged is_placeholder=true\n" +
    "so RLS hides them publicly. Replace with real, consented content before launch."
);
