"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

/**
 * Sign in and create account.
 *
 * Email and password only for now. Apple and Google are configured on the
 * Supabase project but need their provider credentials and a verified Services
 * ID before the buttons can do anything, and a third-party button that fails
 * silently is worse than its absence — this page's previous version made
 * exactly that argument about a fake sign-in form, on the grounds that people
 * type real passwords into things that look functional.
 */
export function AccountClient({ signedIn, email }: { signedIn: boolean; email?: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (signedIn) {
    return (
      <div className="mt-8">
        <p className="text-sm opacity-80">Signed in as {email}</p>
        <Button
          className="mt-5"
          variant="secondary"
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
        >
          Sign out
        </Button>
      </div>
    );
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
          },
        });
        if (error) throw error;
        setMessage("Check your inbox to confirm your email address.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.reload();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="mt-8 max-w-sm">
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />

      {message && <Notice className="mt-4">{message}</Notice>}

      <Button type="submit" className="mt-5 w-full" disabled={busy}>
        {busy ? "Just a moment…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>

      <button
        type="button"
        className="text-dusty-text mt-4 w-full text-center text-sm"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setMessage(null);
        }}
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </form>
  );
}
