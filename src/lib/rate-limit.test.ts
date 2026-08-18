import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * IP resolution and the fail-open contract.
 *
 * The limiter is abuse control, not authentication, and it must fail OPEN: a
 * limiter that is down, or an IP that can't be resolved, has to let the request
 * through rather than lock a whole carrier out of checkout. The IP parsing order
 * (Netlify header first, then the FIRST entry of x-forwarded-for) is equally
 * load-bearing — the wrong entry buckets every visitor behind a proxy together.
 */

vi.mock("server-only", () => ({}));

let mockHeaders: Record<string, string> = {};
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => mockHeaders[k] ?? null }),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mockRpc }),
}));

import { clientIp, allow, allowByIp } from "./rate-limit";

beforeEach(() => {
  mockHeaders = {};
  mockRpc.mockReset();
});

describe("clientIp", () => {
  it("prefers the Netlify connection-ip header", async () => {
    mockHeaders = {
      "x-nf-client-connection-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    };
    expect(await clientIp()).toBe("203.0.113.7");
  });

  it("falls back to the FIRST entry of x-forwarded-for", async () => {
    mockHeaders = { "x-forwarded-for": "198.51.100.1, 10.0.0.1, 10.0.0.2" };
    expect(await clientIp()).toBe("198.51.100.1");
  });

  it("falls back to x-real-ip last", async () => {
    mockHeaders = { "x-real-ip": "192.0.2.5" };
    expect(await clientIp()).toBe("192.0.2.5");
  });

  it("returns null when no client IP can be resolved", async () => {
    expect(await clientIp()).toBeNull();
  });

  it("trims surrounding whitespace", async () => {
    mockHeaders = { "x-nf-client-connection-ip": "  203.0.113.7  " };
    expect(await clientIp()).toBe("203.0.113.7");
  });
});

describe("allow", () => {
  it("permits when the counter is under the limit", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await allow("checkout:ip:x", { windowSeconds: 600, limit: 10 })).toBe(true);
  });

  it("denies when the RPC reports the limit was exceeded", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await allow("checkout:ip:x", { windowSeconds: 600, limit: 10 })).toBe(false);
  });

  it("FAILS OPEN when the limiter errors", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    expect(await allow("checkout:ip:x", { windowSeconds: 600, limit: 10 })).toBe(true);
  });

  it("FAILS OPEN when the limiter throws", async () => {
    mockRpc.mockRejectedValue(new Error("connection refused"));
    expect(await allow("checkout:ip:x", { windowSeconds: 600, limit: 10 })).toBe(true);
  });
});

describe("allowByIp", () => {
  it("allows the request when no IP is resolvable, without calling the limiter", async () => {
    mockHeaders = {};
    expect(await allowByIp("checkout", { windowSeconds: 600, limit: 10 })).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("consults the limiter when an IP is present", async () => {
    mockHeaders = { "x-nf-client-connection-ip": "203.0.113.7" };
    mockRpc.mockResolvedValue({ data: false, error: null });
    expect(await allowByIp("checkout", { windowSeconds: 600, limit: 10 })).toBe(false);
    expect(mockRpc).toHaveBeenCalledOnce();
  });
});
