/**
 * Pre-migration schema snapshot.
 *
 * The Supabase free tier has no backups. Before any migration runs against
 * production, this records what the API surface looked like, so a regression
 * can at least be *identified* — tables and columns that vanished, RPCs that
 * changed shape.
 *
 * This is not a backup and cannot restore data. It is a reference. Real
 * protection is: additive-only migrations, a matching down-migration for each,
 * and upgrading to Pro so point-in-time recovery exists.
 *
 * PostgREST's root endpoint returns an OpenAPI document describing every
 * table, view and function exposed on the `public` schema. That is the whole
 * surface a client can reach, which is exactly what a migration can break.
 *
 * Usage:  node --env-file=.env.local scripts/snapshot-schema.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

if (!res.ok) {
  console.error(`PostgREST returned ${res.status}. Cannot snapshot.`);
  process.exit(1);
}

const spec = await res.json();

// Definitions are tables and views; paths beginning /rpc/ are functions.
const tables = Object.entries(spec.definitions ?? {})
  .map(([name, def]) => ({
    name,
    columns: Object.entries(def.properties ?? {})
      .map(([col, meta]) => ({
        name: col,
        type: meta.format ?? meta.type ?? "unknown",
        required: (def.required ?? []).includes(col),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const rpcs = Object.keys(spec.paths ?? {})
  .filter((p) => p.startsWith("/rpc/"))
  .map((p) => p.slice(5))
  .sort();

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(process.cwd(), "supabase", "snapshots");
mkdirSync(dir, { recursive: true });

const payload = { takenAt: new Date().toISOString(), tables, rpcs };
writeFileSync(join(dir, `${stamp}.json`), JSON.stringify(payload, null, 2));

// A readable companion, so a diff between two snapshots is legible in a PR.
const md = [
  `# Schema snapshot — ${new Date().toISOString()}`,
  ``,
  `${tables.length} tables/views · ${rpcs.length} functions`,
  ``,
  `## Functions`,
  ...rpcs.map((r) => `- \`${r}\``),
  ``,
  `## Tables`,
  ...tables.flatMap((t) => [
    ``,
    `### ${t.name}`,
    ...t.columns.map(
      (c) => `- \`${c.name}\` ${c.type}${c.required ? " · required" : ""}`
    ),
  ]),
].join("\n");
writeFileSync(join(dir, `${stamp}.md`), md);

console.log(`Snapshot written to supabase/snapshots/${stamp}.{json,md}`);
console.log(`  ${tables.length} tables/views`);
console.log(`  ${rpcs.length} functions: ${rpcs.join(", ")}`);
