import { defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";

/** Minimal .env.local reader — avoids a dependency just to run tests locally. */
function loadEnvLocal(): Record<string, string> {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, ".env.local"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (match?.[1] && match[2] !== undefined) out[match[1]] = match[2];
    }
    return out;
  } catch {
    return {};
  }
}

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Loaded so the live integration tests can reach Supabase. They skip
    // themselves when the variables are absent, so CI without secrets still passes.
    env: loadEnvLocal(),
  },
});
