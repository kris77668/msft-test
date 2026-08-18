/**
 * Verifies the security and integrity guarantees of the applied schema.
 *
 * This is the part that cannot be proven by TypeScript: that the PUBLIC key
 * genuinely cannot read private data or write anything, and that Postgres itself
 * refuses to put a bespoke gown in a cart or an order.
 *
 * Run: node --env-file=.env.local scripts/verify-schema.mjs
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

const req = (path, key, init = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

// ── Seed loaded? ──────────────────────────────────────────────────────────
{
  const res = await req("products?select=kind", SECRET);
  const rows = res.ok ? await res.json() : [];
  const counts = rows.reduce((a, r) => ({ ...a, [r.kind]: (a[r.kind] ?? 0) + 1 }), {});
  check(
    "Seed loaded",
    rows.length === 28,
    `${rows.length} products — ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`
  );
}

{
  const res = await req("facet_values?select=facet_key", SECRET);
  const rows = res.ok ? await res.json() : [];
  const counts = rows.reduce((a, r) => ({ ...a, [r.facet_key]: (a[r.facet_key] ?? 0) + 1 }), {});
  check(
    "Facet taxonomy",
    rows.length > 0,
    Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")
  );
}

{
  const res = await req("consultation_types?select=key,deposit_cents", SECRET);
  const rows = res.ok ? await res.json() : [];
  const deposit = rows[0]?.deposit_cents;
  check(
    "Deposit single-sourced",
    rows.length === 3 && deposit === 10000,
    `${rows.length} types, deposit_cents=${deposit} ($${(deposit ?? 0) / 100})`
  );
}

// ── RLS: what can the PUBLIC key see? ─────────────────────────────────────
// Tests the MECHANISM, not a transient state: plant a draft product, confirm it
// is invisible publicly while published ones are visible, then remove it. This
// stays valid regardless of how much of the catalogue is currently published.
{
  const draft = await req("products", SECRET, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      kind: "rtw",
      slug: "rls-draft-canary",
      name: "Draft Canary",
      status: "draft",
      price_cents: 12345,
    }),
  });
  const row = (await draft.json().catch(() => []))[0];

  const pub = await req("products?select=slug,status", PUBLISHABLE);
  const visible = pub.ok ? await pub.json() : [];
  const draftLeaked = visible.some((p) => p.slug === "rls-draft-canary");
  const publishedVisible = visible.length > 0;

  check(
    "RLS filters products by publish status",
    Boolean(row) && !draftLeaked && publishedVisible,
    !row
      ? "INCONCLUSIVE — could not plant draft"
      : draftLeaked
        ? "DRAFT PRODUCT LEAKED to public key"
        : `${visible.length} published visible, draft hidden`
  );

  // The same canary, through search_products.
  //
  // This is the assertion the RPC exists for. `getProducts` carries no
  // `status = 'published'` filter — publication is enforced entirely by RLS —
  // so a SECURITY DEFINER version of this function would run as its owner,
  // bypass the policy, and ship every draft to the website AND the app. The
  // trap is not hypothetical: `get_available_slots` two migrations earlier IS
  // security definer, because it genuinely needs to read past RLS, so copying
  // the neighbouring pattern is the natural mistake.
  //
  // If this ever fails, do not "fix" it by filtering in the client. Make the
  // function SECURITY INVOKER again.
  if (row) {
    const rpc = await req("rpc/search_products", PUBLISHABLE, {
      method: "POST",
      body: JSON.stringify({ p_limit: 500 }),
    });
    const rpcRows = rpc.ok ? await rpc.json() : [];
    const rpcLeaked = rpcRows.some((p) => p.slug === "rls-draft-canary");

    check(
      "search_products hides drafts from public key",
      rpc.ok && !rpcLeaked && rpcRows.length > 0,
      !rpc.ok
        ? `INCONCLUSIVE — rpc returned HTTP ${rpc.status}`
        : rpcLeaked
          ? "DRAFT PRODUCT LEAKED via search_products — is it SECURITY DEFINER?"
          : `${rpcRows.length} published visible, draft hidden`
    );
  }

  if (row) await req(`products?id=eq.${row.id}`, SECRET, { method: "DELETE" });
}

// Private tables must be invisible entirely.
//
// Reading an EMPTY table proves nothing — an absent policy and an absent row
// look identical. So plant a real row with the secret key first, then attempt
// to read it with the public key, then clean up.
{
  const planted = [];

  const plant = async (table, payload) => {
    const res = await req(table, SECRET, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    const row = (await res.json().catch(() => []))[0];
    if (row) planted.push({ table, id: row.id });
    return row;
  };

  await plant("newsletter_subscribers", { email: "rls-canary@example.com" });
  await plant("contact_messages", {
    name: "RLS Canary",
    email: "rls-canary@example.com",
    message: "If the public key can read this, RLS is broken.",
  });
  await plant("story_submissions", {
    name: "RLS Canary",
    email: "rls-canary@example.com",
    story: "Canary row.",
  });
  await plant("orders", {
    email: "rls-canary@example.com",
    first_name: "RLS",
    last_name: "Canary",
    ship_address_line1: "1 Test St",
    ship_suburb: "Sydney",
    ship_state: "NSW",
    ship_postcode: "2000",
    shipping_method: "express",
    subtotal_cents: 1000,
    shipping_cents: 0,
    total_cents: 1000,
    gst_cents: 91,
  });

  for (const table of [
    "orders",
    "newsletter_subscribers",
    "contact_messages",
    "story_submissions",
  ]) {
    const secretRes = await req(`${table}?select=id`, SECRET);
    const actualRows = secretRes.ok ? (await secretRes.json()).length : 0;

    const res = await req(`${table}?select=id`, PUBLISHABLE);
    const body = await res.json().catch(() => null);
    const visible = res.ok && Array.isArray(body) ? body.length : 0;

    check(
      `RLS hides ${table} from public key`,
      actualRows > 0 && visible === 0,
      actualRows === 0
        ? "INCONCLUSIVE — no row planted"
        : visible > 0
          ? `LEAKING ${visible} of ${actualRows} rows`
          : `${actualRows} row(s) exist, 0 visible publicly`
    );
  }

  for (const { table, id } of planted) {
    await req(`${table}?id=eq.${id}`, SECRET, { method: "DELETE" });
  }
}

// ── RLS: the public key must not be able to WRITE anywhere ────────────────
{
  const res = await req("newsletter_subscribers", PUBLISHABLE, {
    method: "POST",
    body: JSON.stringify({ email: "rls-probe@example.com" }),
  });
  check(
    "RLS blocks public INSERT",
    !res.ok,
    res.ok ? "WROTE A ROW — policy missing!" : `rejected HTTP ${res.status}`
  );
}

// A 204 from PostgREST only means "no rows matched" — it does not prove the
// price survived. Read the actual value back with the secret key afterwards.
{
  const before = (await (await req("products?slug=eq.iris&select=price_cents", SECRET)).json())[0];

  await req("products?slug=eq.iris", PUBLISHABLE, {
    method: "PATCH",
    body: JSON.stringify({ price_cents: 1 }),
  });

  const after = (await (await req("products?slug=eq.iris&select=price_cents", SECRET)).json())[0];
  const unchanged = before?.price_cents === after?.price_cents;

  check(
    "RLS blocks public price tampering",
    unchanged,
    unchanged
      ? `price held at ${after?.price_cents} cents`
      : `PRICE CHANGED ${before?.price_cents} -> ${after?.price_cents}`
  );
}

// ── The Postgres layer of the two-path guarantee ──────────────────────────
// Using the SECRET key, which bypasses RLS entirely. If the constraint holds
// against the secret key, it holds against everything.
{
  const gownRes = await req("products?kind=eq.bespoke&select=id,slug&limit=1", SECRET);
  const gown = (await gownRes.json())[0];

  const orderRes = await req("orders", SECRET, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      email: "constraint-probe@example.com",
      first_name: "Probe",
      last_name: "Test",
      ship_address_line1: "1 Test St",
      ship_suburb: "Sydney",
      ship_state: "NSW",
      ship_postcode: "2000",
      shipping_method: "express",
      subtotal_cents: 480000,
      shipping_cents: 0,
      total_cents: 480000,
      gst_cents: 43636,
    }),
  });
  const order = (await orderRes.json().catch(() => []))[0];

  if (!order || !gown) {
    check("DB rejects bespoke in order_items", false, "could not set up probe");
  } else {
    const res = await req("order_items", SECRET, {
      method: "POST",
      body: JSON.stringify({
        order_id: order.id,
        product_id: gown.id,
        product_kind: "bespoke",
        product_name: "Probe",
        product_slug: gown.slug,
        size: "AU 8",
        unit_price_cents: 480000,
        qty: 1,
      }),
    });
    const body = await res.json().catch(() => ({}));
    check(
      "DB rejects bespoke in order_items",
      !res.ok,
      res.ok ? "INSERTED — constraint missing!" : `${body.code ?? ""} ${(body.message ?? "").slice(0, 80)}`
    );

    // Also prove the smuggling route is closed: claim it is 'rtw' while
    // pointing at a bespoke product id. The composite FK has no such row.
    const smuggle = await req("order_items", SECRET, {
      method: "POST",
      body: JSON.stringify({
        order_id: order.id,
        product_id: gown.id,
        product_kind: "rtw",
        product_name: "Probe",
        product_slug: gown.slug,
        size: "AU 8",
        unit_price_cents: 480000,
        qty: 1,
      }),
    });
    const sBody = await smuggle.json().catch(() => ({}));
    check(
      "DB rejects bespoke id mislabelled as rtw",
      !smuggle.ok,
      smuggle.ok ? "INSERTED — composite FK missing!" : `${sBody.code ?? ""} ${(sBody.message ?? "").slice(0, 80)}`
    );

    await req(`orders?id=eq.${order.id}`, SECRET, { method: "DELETE" });
  }
}

// ── Pricing shape constraint ──────────────────────────────────────────────
{
  const res = await req("products", SECRET, {
    method: "POST",
    body: JSON.stringify({
      kind: "bespoke",
      slug: "constraint-probe-gown",
      name: "Probe",
      price_cents: 100000, // a bespoke gown must not carry a single price
    }),
  });
  const body = await res.json().catch(() => ({}));
  check(
    "DB rejects bespoke with a single price",
    !res.ok,
    res.ok ? "INSERTED — CHECK missing!" : `${body.code ?? ""} ${(body.message ?? "").slice(0, 60)}`
  );
  if (res.ok) await req("products?slug=eq.constraint-probe-gown", SECRET, { method: "DELETE" });
}

// ── Availability function ─────────────────────────────────────────────────
{
  const res = await fetch(`${URL_}/rest/v1/rpc/get_available_slots`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE,
      Authorization: `Bearer ${PUBLISHABLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => null);
  check(
    "get_available_slots callable by public key",
    res.ok,
    res.ok ? `${Array.isArray(body) ? body.length : 0} slots (none generated yet)` : `HTTP ${res.status}`
  );
}

// ── RLS coverage across every table ───────────────────────────────────────
{
  const res = await fetch(`${URL_}/rest/v1/rpc/assert_rls_enabled`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const rows = res.ok ? await res.json() : [];
  const unprotected = rows.filter((r) => !r.rls_enabled);
  check(
    "RLS enabled on every public table",
    res.ok && unprotected.length === 0,
    unprotected.length
      ? `UNPROTECTED: ${unprotected.map((r) => r.table_name).join(", ")}`
      : `${rows.length} tables, all protected`
  );
}

// ── Privilege escalation: a customer must not be able to make themselves an
//    admin ──────────────────────────────────────────────────────────────────
//
// This is the guarantee the whole admin area rests on, and it is one line of
// SQL away from being lost: `profiles_owner_write` lets a user update their own
// row, and an RLS policy authorises a ROW, not a set of columns. What stops the
// write is the column grant in 20260721000010 — Postgres checks privileges
// before it evaluates any policy.
//
// Postgres's own error hint for this failure reads "Grant the required
// privileges to the current role with: GRANT UPDATE ON public.profiles TO
// authenticated;" — following that hint re-opens the hole. Hence this check.
{
  const email = `schema-check-${Date.now()}@example.com`;
  const password = `Chk-${Math.random().toString(36).slice(2)}!A9`;
  let userId = null;

  try {
    const created = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    userId = created.ok ? (await created.json()).id : null;

    const tokenRes = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const accessToken = tokenRes.ok ? (await tokenRes.json()).access_token : null;

    if (!userId || !accessToken) {
      check("profiles.role not self-writable", false, "INCONCLUSIVE — could not create a test user");
    } else {
      const asUser = {
        apikey: PUBLISHABLE,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      };

      const attack = await fetch(`${URL_}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: asUser,
        body: JSON.stringify({ role: "admin" }),
      });

      const after = await req(`profiles?id=eq.${userId}&select=role`, SECRET);
      const role = after.ok ? (await after.json())[0]?.role : "unknown";

      check(
        "profiles.role not self-writable",
        !attack.ok && role === "customer",
        !attack.ok && role === "customer"
          ? `blocked (HTTP ${attack.status}), role still "${role}"`
          : `ESCALATION POSSIBLE — HTTP ${attack.status}, role is now "${role}"`
      );

      // The legitimate columns must still be writable, or the account page breaks.
      const legit = await fetch(`${URL_}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: asUser,
        body: JSON.stringify({ first_name: "Check" }),
      });
      check(
        "profiles own name still writable",
        legit.ok,
        legit.ok ? "first_name updated by owner" : `HTTP ${legit.status} — grants too narrow`
      );
    }
  } finally {
    if (userId) {
      await fetch(`${URL_}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
      });
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────
for (const { name, pass, detail } of results) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name.padEnd(42)} ${detail ?? ""}`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
