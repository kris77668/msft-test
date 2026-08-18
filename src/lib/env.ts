import "server-only";
import { z } from "zod";

/**
 * Environment validation.
 *
 * Deliberately lazy: reading `env` throws with a readable message listing every
 * missing/invalid variable, rather than failing somewhere deep in a request with
 * `undefined is not a string`. Nothing here is imported by client code — this
 * module is `server-only`, so an accidental client import fails at build time
 * rather than shipping secrets to the browser.
 */

/** Supabase issues both the modern `sb_*` keys and legacy `eyJ...` JWTs. Accept either. */
const supabaseKey = (kind: "publishable" | "secret") =>
  z
    .string()
    .refine(
      (v) => v.startsWith(`sb_${kind}_`) || v.startsWith("eyJ"),
      `must be an sb_${kind}_… key (or a legacy JWT)`
    );

const serverSchema = z.object({
  // ── Supabase ────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .refine((v) => v.startsWith("https://"), "must be the https project URL"),

  // Public by design — ships in the browser bundle. Safe only because RLS
  // grants it read access to published rows and no write access anywhere.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseKey("publishable"),

  // Bypasses RLS completely. Server-only, never NEXT_PUBLIC_, never in a client
  // component. If this leaks, every customer record and order is readable and
  // writable by anyone who finds it.
  SUPABASE_SECRET_KEY: supabaseKey("secret"),

  // ── Stripe ──────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z
    .string()
    .refine((v) => v.startsWith("sk_"), "must start with sk_"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .refine((v) => v.startsWith("pk_"), "must start with pk_"),

  // Distinct per environment. Using the production secret locally makes every
  // signature check fail, and the failure looks like a routing bug.
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .refine((v) => v.startsWith("whsec_"), "must start with whsec_"),

  // ── Email (Brevo: newsletter + transactional) ───────────────────────────
  BREVO_API_KEY: z.string().min(1, "required"),

  // ── Site ────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .refine((v) => v.startsWith("http"), "must be an absolute URL"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example for the full list.`
    );
  }

  cached = parsed.data;
  return cached;
}
