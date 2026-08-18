"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/notice";
import type { ActionResult } from "@/lib/admin/result";

/**
 * A form wired to an admin server action, with its failure shown.
 *
 * Exists because a plain `<form action={serverAction}>` in a Server Component
 * requires the action to return void — so any error it produced would be
 * discarded and the row would simply not change, with no explanation. Passing
 * the action into this client wrapper keeps `useActionState` available and the
 * message visible.
 *
 * Server actions may be passed from Server Components to Client Components as
 * props; only the generated reference crosses, not the implementation.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage = false,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  successMessage?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <>
      <form action={formAction} className={className}>
        {children}
      </form>

      {state && !state.ok && <Notice className="mt-2">{state.error}</Notice>}
      {successMessage && state?.ok && (
        <Notice tone="quiet" className="mt-2">
          {state.message}
        </Notice>
      )}
    </>
  );
}
