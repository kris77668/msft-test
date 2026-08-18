import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limiting for the mutation endpoints.
 *
 * AGENTS.md gives rate limiting as one of the reasons every mutation goes
 * through a route handler rather than an RLS write policy — but nothing
 * implemented it. The sharpest consequence was the newsletter: resubmitting an
 * address already in `pending` re-sent the confirmation email every time, to
 * any address, from the atelier's own verified sending domain. That is an
 * unlimited mail amplifier pointed at a third party.
 *
 * Counting happens in Postgres (`bump_rate_limit`, migration 006) as a single
 * atomic insert-on-conflict-returning. Doing it here as a read then a write
 * would race under exactly the concurrent load it exists to control, and an
 * in-memory counter would be per-instance — useless on serverless.
 *
 * FAILS OPEN, DELIBERATELY. If the limiter errors, or the client IP cannot be
 * resolved, the request is allowed. A limiter that is down must not stop
 * customers buying gowns, and an unresolvable IP must not bucket every visitor
 * behind the planet into one shared counter — which would lock the entire site
 * out of checkout the moment the header name changed.
 */

export interface RateLimitRule {
  /** Window length in seconds. */
  windowSeconds: number;
  /** Requests permitted per window. The request that hits the limit is served. */
  limit: number;
}

/**
 * Tuned so a real person never notices and a script does immediately.
 *
 * `newsletterAddress` is the mailbomb guard: it is keyed on the ADDRESS, not
 * the sender, so an attacker rotating IPs still cannot mail a victim more than
 * twice an hour.
 */
export const RATE_LIMITS = {
  newsletterAddress: { windowSeconds: 3600, limit: 2 },
  newsletterIp: { windowSeconds: 3600, limit: 10 },
  contactIp: { windowSeconds: 3600, limit: 5 },
  checkoutIp: { windowSeconds: 600, limit: 10 },
  consultationIp: { windowSeconds: 3600, limit: 8 },
  /**
   * Cart pricing, and deliberately the loosest rule here by a wide margin.
   *
   * Two reasons it cannot be tuned like the others. It is a READ with no side
   * effect — no money, no email, no row written — so the usual justification
   * for a tight limit does not apply; the cap exists only to stop a runaway
   * script, not to police normal use.
   *
   * More importantly, the companion Flutter app calls this endpoint, and mobile
   * traffic arrives through carrier-grade NAT: thousands of subscribers can
   * share one public IP. A limit sized for a single browser would lock out
   * every customer on a busy carrier at once, and it would present as "the app
   * is broken" with nothing in the logs pointing here. Sized so a shared NAT
   * egress has room and only a pathological caller is caught.
   */
  cartPriceIp: { windowSeconds: 600, limit: 300 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * The caller's IP, or null when it cannot be determined.
 *
 * Netlify sets `x-nf-client-connection-ip`; `x-forwarded-for` is the standard
 * fallback and may be a comma-separated chain, of which the FIRST entry is the
 * client. Both are spoofable by anyone talking directly to the origin, so this
 * is abuse control, not authentication — never make an authorisation decision
 * on it.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();

  const direct = h.get("x-nf-client-connection-ip");
  if (direct) return direct.trim();

  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return h.get("x-real-ip")?.trim() ?? null;
}

/**
 * Consumes one unit against `key`. Returns true when the caller may proceed.
 *
 * `key` should be namespaced by purpose so limits do not collide, e.g.
 * `checkout:ip:203.0.113.4`.
 */
export async function allow(key: string, rule: RateLimitRule): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("bump_rate_limit", {
      p_key: key,
      p_window_seconds: rule.windowSeconds,
      p_limit: rule.limit,
    });

    if (error) {
      console.error("[rate-limit] bump failed, allowing:", error.message);
      return true;
    }

    return data !== false;
  } catch (err) {
    console.error("[rate-limit] unavailable, allowing:", (err as Error).message);
    return true;
  }
}

/**
 * Convenience for the common "limit this endpoint per client IP" case.
 * Allows the request when no IP can be resolved — see the fail-open note above.
 */
export async function allowByIp(scope: string, rule: RateLimitRule): Promise<boolean> {
  const ip = await clientIp();
  if (!ip) return true;

  return allow(`${scope}:ip:${ip}`, rule);
}
