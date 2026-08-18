"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

/**
 * Sign-in only. See the page comment for why there is no sign-up here.
 *
 * On success this does a full document navigation rather than a router push:
 * the session cookie is set by the Supabase client after the response, and a
 * client-side transition would render the admin layout against the *previous*
 * request's cookies and bounce straight back to this form.
 */
export function AdminLoginForm({ next }: { next: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Supabase already returns an undifferentiated "Invalid login
      // credentials" for both a wrong password and an unknown address, which
      // is the behaviour we want — it does not confirm whether an account
      // exists. Passing its message straight through preserves that.
      setError(signInError.message);
      setBusy(false);
      return;
    }

    window.location.assign(next);
  }

  return (
    <form action={submit} className="mt-8 space-y-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      {error && <Notice>{error}</Notice>}

      <Button type="submit" fullWidth disabled={busy} className="mt-2">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
