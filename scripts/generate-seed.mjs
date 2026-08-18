/**
 * Generates supabase/seed.sql from the design handoff catalogue.
 *
 * Transcribed from design_handoff/site/core.jsx (EVENING, ACCESSORIES, BESPOKE).
 * EVERY NAME AND PRICE HERE IS PLACEHOLDER — the live msfairytale.com.au is a
 * portfolio gallery with no product names and no prices anywhere. Products are
 * seeded as status='draft' so nothing invented can reach production by accident.
 *
 * Generating rather than hand-writing also fixes the prototype's filter bug
 * structurally: its FILTERS/B_FILTERS arrays were maintained by hand and had
 * drifted from the data, omitting 'Silk Organza', 'Hand-embroidered Lace',
 * 'Tulle & Embroidery' and 'Beaded Chiffon' — leaving Soleil and 3 of 10 gowns
 * unreachable by fabric filter. Deriving facet values from the products
 * themselves means the lists cannot drift again.
 *
 * Run: node scripts/generate-seed.mjs
 */

import { writeFile } from "node:fs/promises";

const IMG = (n) => `/images/fashion/${n}.jpg`;
const eve = (n) => IMG(`evening-dress-ms-fairy-tale-${n}`);
const wed = (n) => IMG(`wedding-dress-ms-fairy-tale-${n}`);
const dress = (n) => IMG(`ms-fairy-tale-dress-${n}`);

const RTW_LEAD = "Made to order — ships in 8–10 weeks";
const BESPOKE_LEAD = "A commission of 8–12 months, from first sketch to final fitting";

// ── Evening wear — e-commerce, single price, cart-eligible ────────────────
const EVENING = [
  ["iris","Iris",2400,"Blush","Silk Crêpe","Column","Cowl","Cocktail","New",eve("001"),[eve("001"),dress("001"),eve("002")]],
  ["ember","Ember",2800,"Burgundy","Velvet","Mermaid","V-neck","Gala","New",eve("003"),[eve("003"),eve("004"),dress("002")]],
  ["nocturne","Nocturne",3200,"Midnight","Sequin","Column","Halter","Black Tie",null,eve("005"),[eve("005"),eve("006"),dress("003")]],
  ["florence","Florence",2900,"Emerald","Silk Taffeta","Ball Gown","Strapless","Gala",null,eve("007"),[eve("007"),eve("008"),dress("004")]],
  ["paloma","Paloma",2600,"Champagne","Beaded Chiffon","A-line","One-shoulder","Races","Atelier",eve("009"),[eve("009"),eve("010"),dress("005")]],
  ["cassia","Cassia",2500,"Navy","Silk Satin","Slip","Square","Cocktail",null,eve("011"),[eve("011"),eve("012"),dress("006")]],
  ["ophelie","Ophélie",3100,"Plum","Devoré Velvet","Fit & Flare","V-neck","Gala",null,eve("013"),[eve("013"),eve("014"),dress("007")]],
  ["soleil","Soleil",2200,"Coral","Silk Organza","A-line","Strapless","Races","Bestseller",eve("050"),[eve("050"),eve("051"),dress("008")]],
  ["lumiere","Lumière",3400,"Gold","Lamé","Column","Cowl","Black Tie",null,eve("052"),[eve("052"),eve("053"),dress("009")]],
  ["verena","Verena",2700,"Sage","Crêpe","Mermaid","Halter","Cocktail","New",eve("054"),[eve("054"),eve("055"),dress("010")]],
  ["aria","Aria",2300,"Dove","Chiffon","A-line","One-shoulder","Ceremony",null,eve("056"),[eve("056"),eve("057"),dress("011")]],
  ["seren","Seren",2950,"Rose Gold","Sequin","Slip","V-neck","Gala",null,eve("058"),[eve("058"),eve("059"),dress("012")]],
  ["delphine","Delphine",2650,"Ivory","Silk Satin","Ball Gown","Strapless","Ceremony",null,eve("060"),[eve("060"),eve("061"),dress("013")]],
  ["noor","Noor",3050,"Onyx","Velvet","Fit & Flare","Square","Black Tie","Atelier",eve("062"),[eve("062"),eve("070"),dress("014")]],
  ["wren","Wren",2150,"Blush","Organza","A-line","Halter","Races",null,eve("071"),[eve("071"),eve("072"),dress("015")]],
  ["juno","Juno",3300,"Emerald","Devoré Velvet","Mermaid","Cowl","Gala",null,eve("073"),[eve("073"),eve("074"),dress("016")]],
].map(([slug,name,price,colour,fabric,silhouette,neckline,occasion,badge,img,gallery]) => ({
  kind:"rtw", slug, name, priceCents: price*100, colour, badge, img, gallery,
  leadTime: RTW_LEAD,
  facets:{ silhouette:[silhouette], fabric:splitFabric(fabric), neckline:[neckline], occasion:[occasion] },
}));

// ── Accessories — a distinct kind, not evening wear ───────────────────────
// The prototype listed these in SHOP_ITEMS but filtered EVENING, so they were
// reachable by URL and invisible in every listing. As their own kind they get
// a real taxonomy instead of silhouette:'Accessory' / neckline:'—'.
const ACCESSORIES = [
  ["veil-cathedral","Cathedral Veil",480,"Ivory","Silk Tulle","Ceremony",dress("017"),[dress("017"),wed("070")]],
  ["gloves-opera","Opera Gloves",160,"Ivory","Satin","Black Tie",dress("018"),[dress("018"),eve("075")]],
].map(([slug,name,price,colour,fabric,occasion,img,gallery]) => ({
  kind:"accessory", slug, name, priceCents: price*100, colour, badge:null, img, gallery,
  leadTime:"In stock — dispatched within 2 business days",
  facets:{ fabric:splitFabric(fabric), occasion:[occasion] },
}));

// ── Bespoke bridal — price RANGE, never cart-eligible ─────────────────────
const BESPOKE = [
  ["aurelie","Aurélie","A-line","French Chantilly Lace","V-neck",4800,6200,"New",wed("001"),[wed("001"),wed("002"),wed("003")]],
  ["celestine","Célestine","Ball Gown","Silk Mikado","Strapless",6200,8400,"Signature",wed("004"),[wed("004"),wed("005"),wed("006")]],
  ["odette","Odette","Mermaid","Beaded Tulle","Illusion",5400,7200,null,wed("050"),[wed("050"),wed("051"),wed("052")]],
  ["liora","Liora","Sheath","Crêpe & Lace","Square",3900,5100,null,wed("053"),[wed("053"),wed("054"),wed("055")]],
  ["mireille","Mireille","Ball Gown","Tulle & Embroidery","Sweetheart",5800,7600,"Bestseller",wed("056"),[wed("056"),wed("057"),wed("058")]],
  ["selene","Séléne","A-line","Italian Satin","Cowl",4200,5600,null,wed("059"),[wed("059"),wed("060"),wed("061")]],
  ["amaryllis","Amaryllis","Princess","Hand-embroidered Lace","Off-shoulder",7400,9800,"Couture",wed("062"),[wed("062"),wed("063"),wed("064")]],
  ["noemie","Noémie","Slip","Silk Charmeuse","V-neck",3200,4400,"Minimal",wed("065"),[wed("065"),wed("070"),wed("071")]],
  ["rosaline","Rosaline","Ball Gown","Organza & Lace","Strapless",5000,6800,null,wed("072"),[wed("072"),wed("073"),wed("002")]],
  ["violette","Violette","Mermaid","Beaded Chiffon","Halter",4600,6000,null,wed("003"),[wed("003"),wed("005"),wed("051")]],
].map(([slug,name,silhouette,fabric,neckline,from,to,badge,img,gallery]) => ({
  kind:"bespoke", slug, name, fromCents: from*100, toCents: to*100, colour:null, badge, img, gallery,
  leadTime: BESPOKE_LEAD,
  facets:{ silhouette:[silhouette], fabric:splitFabric(fabric), neckline:[neckline] },
}));

/**
 * 'Crêpe & Lace' is two fabrics jammed into one string. The prototype stored it
 * whole, so filtering by "Lace" silently missed those gowns. Splitting lets a
 * gown genuinely carry both; the PDP rejoins them with ' & ' for display.
 */
function splitFabric(fabric) {
  return fabric.split(" & ").map((f) => f.trim());
}

const ALL = [...EVENING, ...ACCESSORIES, ...BESPOKE];

// ── Facet taxonomy, derived from the products themselves ──────────────────
const FACET_DEFS = [
  { key:"silhouette", label:"Silhouette", appliesTo:["rtw","bespoke"] },
  { key:"fabric",     label:"Fabric",     appliesTo:["rtw","accessory","bespoke"] },
  { key:"neckline",   label:"Neckline",   appliesTo:["rtw","bespoke"] },
  { key:"occasion",   label:"Occasion",   appliesTo:["rtw","accessory"] },
];

const facetValues = new Map(FACET_DEFS.map((f) => [f.key, new Set()]));
for (const p of ALL) {
  for (const [key, values] of Object.entries(p.facets ?? {})) {
    for (const v of values) facetValues.get(key).add(v);
  }
}

const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
   .toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

const SIZES = ["AU 6","AU 8","AU 10","AU 12","AU 14","AU 16"];

// ── Emit ──────────────────────────────────────────────────────────────────
const out = [];
out.push(`-- GENERATED by scripts/generate-seed.mjs — do not edit by hand.
-- Re-run the generator instead.
--
-- ALL NAMES AND PRICES ARE PLACEHOLDER. Products are seeded as 'draft' so the
-- RLS public-read policy (status = 'published') hides them until real catalogue
-- data replaces them.

begin;

-- Idempotent: safe to re-run.
truncate table product_facet_values, product_sizes, product_images, products,
               facet_values, facets, consultation_types, faqs, testimonials
  restart identity cascade;
`);

// Facets
out.push(`\n-- ── Facets ────────────────────────────────────────────────────────────────`);
FACET_DEFS.forEach((f, i) => {
  const arr = `array[${f.appliesTo.map((k) => `'${k}'`).join(",")}]::product_kind[]`;
  out.push(`insert into facets (key, label, position, applies_to) values (${q(f.key)}, ${q(f.label)}, ${i}, ${arr});`);
});

out.push("");
for (const { key } of FACET_DEFS) {
  const values = [...facetValues.get(key)].sort();
  values.forEach((v, i) => {
    out.push(`insert into facet_values (facet_key, value, slug, position) values (${q(key)}, ${q(v)}, ${q(slugify(v))}, ${i});`);
  });
}

// Products
out.push(`\n-- ── Products ──────────────────────────────────────────────────────────────`);
for (const p of ALL) {
  const isBespoke = p.kind === "bespoke";
  out.push(`
insert into products (kind, slug, name, status, price_cents, price_from_cents, price_to_cents, colour, lead_time_note, badge)
values (${q(p.kind)}, ${q(p.slug)}, ${q(p.name)}, 'draft',
        ${isBespoke ? "NULL" : p.priceCents},
        ${isBespoke ? p.fromCents : "NULL"},
        ${isBespoke ? p.toCents : "NULL"},
        ${q(p.colour)}, ${q(p.leadTime)}, ${q(p.badge)});`);

  // Images. Alt text is required by a CHECK constraint — the prototype shipped
  // alt="" on every single image, which is both an SEO and a WCAG failure.
  p.gallery.forEach((path, i) => {
    const alt =
      i === 0
        ? `${p.name} — ${isBespoke ? "bespoke wedding gown" : "evening wear"} by Ms Fairy Tale`
        : `${p.name}, detail view ${i}`;
    out.push(`insert into product_images (product_id, path, alt, position) select id, ${q(path)}, ${q(alt)}, ${i} from products where slug = ${q(p.slug)};`);
  });

  // Sizes for cart-eligible kinds only. A bespoke gown must never render a size
  // selector — it is made to the client's measurements.
  if (!isBespoke) {
    SIZES.forEach((label, i) => {
      out.push(`insert into product_sizes (product_id, product_kind, label, position) select id, ${q(p.kind)}::product_kind, ${q(label)}, ${i} from products where slug = ${q(p.slug)};`);
    });
  }

  for (const [facetKey, values] of Object.entries(p.facets ?? {})) {
    for (const v of values) {
      out.push(`insert into product_facet_values (product_id, facet_value_id) select p.id, fv.id from products p, facet_values fv where p.slug = ${q(p.slug)} and fv.facet_key = ${q(facetKey)} and fv.slug = ${q(slugify(v))};`);
    }
  }
}

// Consultation types — the single source of the deposit amount.
out.push(`
-- ── Consultation types ────────────────────────────────────────────────────
-- deposit_cents is THE source of truth for the $100. The prototype hardcoded
-- "$100" as a bare string in five places. Set to 0 to make consultations free
-- without touching code.
insert into consultation_types (key, label, description, deposit_cents, duration_minutes, position) values
  ('bridal', 'Bridal — Bespoke Wedding Gown', 'The full atelier journey: design, toile, fittings.', 10000, 60, 0),
  ('evening', 'Evening Wear Styling', 'Choose or customise a made-to-order evening piece.', 10000, 60, 1),
  ('alteration', 'Alterations & Advice', 'Bring an existing gown or simply talk possibilities.', 10000, 60, 2);
`);

// FAQs — copy reconciled to "3 conversations, 3 fittings" per the client.
out.push(`-- ── FAQs ──────────────────────────────────────────────────────────────────
-- Lead-time and fitting counts reconciled to 3 conversations / 3 fittings.
-- The prototype contradicted itself: Home said "three conversations, six
-- fittings", the bespoke pages said four chapters, the FAQ said "three to four".
insert into faqs (category, question, answer, position) values
  ('Ordering & Timeframes', 'How far in advance should I order a bespoke gown?', 'We recommend beginning your bespoke journey 8–12 months before your wedding. That allows time for design, three fittings, and finishing. Shorter timelines can sometimes be accommodated — please enquire.', 0),
  ('Ordering & Timeframes', 'What is the lead time on evening wear?', 'Made-to-order evening pieces ship within 8–10 weeks. In-stock accessories dispatch within 2 business days.', 1),
  ('Sizing & Measurements', 'How do I measure myself at home?', 'Measure over your underwear, keeping the tape level and snug but not tight. Bust at the fullest point, waist at the narrowest, hip about 20cm below the waist. If you are between sizes we will always advise on the larger.', 2),
  ('Sizing & Measurements', 'What if I am between sizes?', 'Every made-to-order piece is cut to your measurements, so exact sizing matters less than it would off the rack. We confirm every measurement with you before cutting.', 3),
  ('Alterations', 'Are alterations included?', 'Bespoke commissions include three fittings. Alterations to evening wear are quoted separately and depend on the change.', 4),
  ('Gown Care', 'How should I care for my gown?', 'Professionally dry-clean only. Store padded on a wide hanger away from direct light. A printed care card is included with every gown.', 5),
  ('Shipping & Returns', 'Do you ship outside Australia?', 'At launch we ship within Australia only. Please contact us for international enquiries.', 6),
  ('Shipping & Returns', 'Can I return a made-to-order piece?', 'Made-to-order pieces are final sale, as they are cut to your measurements. In-stock accessories may be returned within 14 days.', 7);
`);

// Site settings — placeholder, flagged.
out.push(`-- ── Site settings ─────────────────────────────────────────────────────────
-- PLACEHOLDER. The studio address is unconfirmed; the brief said to flag it
-- rather than hardcode the old Double Bay address. content_is_placeholder = true
-- keeps every dependent surface visibly marked until real details are supplied.
insert into site_settings (id, studio_name, legal_name, studio_address_line, studio_suburb,
                           studio_state, studio_postcode, studio_locality, phone, email,
                           instagram_url, opening_hours, abn, content_is_placeholder)
-- CONFIRMED by the studio: legal entity, ABN, phone, suburb/state/postcode.
--
-- studio_name is the BRAND and legal_name is the REGISTERED ENTITY. They are
-- separate on purpose: the site chrome says "Ms Fairy Tale", the tax invoice
-- says "Ms Fairy Tale Pty Ltd" beside the ABN. Do not collapse them.
--
-- The ABN is validated against the ATO modulus-89 checksum at use
-- (src/lib/site/abn.ts), which is what unlocks the tax-invoice block on order
-- confirmation emails.
--
-- studio_address_line is NULL: the studio gave a suburb-level address with no
-- street line, and formatAddress() omits missing parts rather than printing a
-- placeholder. opening_hours has NOT been confirmed by the studio.
values (true, 'Ms Fairy Tale', 'Ms Fairy Tale Pty Ltd', null, 'Waterloo', 'NSW', '2017',
        'Waterloo', '0434 911 193', 'info@msfairytale.com.au',
        'https://www.instagram.com/msfairytale.com.au/',
        'By appointment, Tuesday–Saturday', '52 613 500 404', true)
on conflict (id) do nothing;

commit;
`);

await writeFile("supabase/seed.sql", out.join("\n") + "\n", "utf8");

const counts = ALL.reduce((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {});
console.log("Wrote supabase/seed.sql");
console.log(`  products: ${ALL.length} (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")})`);
for (const { key } of FACET_DEFS) {
  console.log(`  facet ${key.padEnd(11)} ${facetValues.get(key).size} values`);
}
