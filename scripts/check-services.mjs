/**
 * Verifies that every external service in .env.local authenticates.
 *
 * Prints status only — never a key, not even partially beyond a short prefix,
 * so this is safe to run with output shared.
 *
 * Run: node --env-file=.env.local scripts/check-services.mjs
 */

const results = [];

const record = (service, ok, detail) => results.push({ service, ok, detail });

/** Show enough to identify which key is loaded, never enough to use it. */
const fingerprint = (key) =>
  key ? `${key.slice(0, key.indexOf("_", key.indexOf("_") + 1) + 1 || 8)}…(${key.length} chars)` : "MISSING";

// ── Supabase ──────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

try {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  record("Supabase (secret key)", res.ok, `HTTP ${res.status}`);
} catch (err) {
  record("Supabase (secret key)", false, err.message);
}

// Does the schema exist yet? Query a table the migrations create.
try {
  const res = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  if (res.ok) {
    const rows = await res.json();
    record("Supabase schema", true, `products table exists (${rows.length} row sampled)`);
  } else {
    const body = await res.json().catch(() => ({}));
    record("Supabase schema", false, `HTTP ${res.status} — ${body.message ?? "migrations not applied yet"}`);
  }
} catch (err) {
  record("Supabase schema", false, err.message);
}

// ── Stripe ────────────────────────────────────────────────────────────────
try {
  const res = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  const body = await res.json();
  record(
    "Stripe (secret key)",
    res.ok,
    res.ok ? `livemode=${body.livemode}` : body.error?.message
  );
} catch (err) {
  record("Stripe (secret key)", false, err.message);
}

// Which payment methods are actually enabled on the account? This decides
// whether Afterpay and Zip can ship at launch or need dropping.
try {
  const res = await fetch(
    "https://api.stripe.com/v1/payment_method_configurations",
    { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } }
  );
  const body = await res.json();
  if (res.ok && body.data?.length) {
    const cfg = body.data[0];
    const enabled = Object.entries(cfg)
      .filter(([, v]) => v && typeof v === "object" && v.display_preference)
      .filter(([, v]) => v.display_preference.value !== "off")
      .map(([k]) => k);
    record("Stripe payment methods", true, enabled.join(", ") || "none enabled");
  } else {
    record("Stripe payment methods", false, body.error?.message ?? "no configuration returned");
  }
} catch (err) {
  record("Stripe payment methods", false, err.message);
}

// ── Brevo ─────────────────────────────────────────────────────────────────
try {
  const res = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
  });
  const body = await res.json();
  record(
    "Brevo",
    res.ok,
    res.ok ? `${body.email ?? "account ok"} · plan ${body.plan?.[0]?.type ?? "?"}` : body.message
  );
} catch (err) {
  record("Brevo", false, err.message);
}

// ── Report ────────────────────────────────────────────────────────────────
console.log("Keys loaded:");
console.log(`  SUPABASE_SECRET_KEY   ${fingerprint(secretKey)}`);
console.log(`  STRIPE_SECRET_KEY     ${fingerprint(process.env.STRIPE_SECRET_KEY)}`);
console.log(`  BREVO_API_KEY         ${fingerprint(process.env.BREVO_API_KEY)}`);
console.log("");

for (const { service, ok, detail } of results) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${service.padEnd(24)} ${detail ?? ""}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
