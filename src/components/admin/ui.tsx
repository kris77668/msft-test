"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { clsx } from "@/lib/clsx";
import { Button } from "@/components/ui/button";

/**
 * Small shared pieces for the admin screens.
 *
 * Deliberately thin. The public site's primitives (Button, Field, Notice) do
 * the real work; these only cover the shapes the desk needs and the site does
 * not — a table, a status pill, a pending-aware submit.
 */

/** Submit button that disables and relabels itself while the action runs. */
export function SubmitButton({
  children = "Save",
  pendingLabel = "Saving…",
  ...rest
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
} & Omit<React.ComponentProps<typeof Button>, "children" | "type" | "disabled">) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * A destructive submit that asks first.
 *
 * `confirm()` blocks the main thread and is ugly, but it is also impossible to
 * miss and needs no state. Deleting a gown is rare and irreversible; a custom
 * modal here would be more code for a worse guarantee.
 */
export function DangerSubmit({
  children,
  confirmMessage,
}: {
  children: React.ReactNode;
  confirmMessage: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      className="eyebrow text-error hover:border-error cursor-pointer border-b border-transparent py-1 transition-colors disabled:opacity-50"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

const PILL_TONES = {
  live: "border-mocha text-mocha",
  draft: "border-gold text-gold-text",
  muted: "border-rule text-dusty-text",
  warn: "border-error text-error",
} as const;

/** Publication state, and anything else with a small fixed vocabulary. */
export function Pill({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof PILL_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "eyebrow inline-flex items-center border px-2 py-1 text-[9px]",
        PILL_TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

/** Page title, optional description, optional right-aligned action. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="border-rule mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <h1 className="font-display text-3xl font-light">{title}</h1>
        {description && <p className="mt-2 max-w-[60ch] text-sm opacity-70">{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className="eyebrow border-mocha hover:bg-mocha hover:text-cream border px-5 py-3 transition-colors">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Horizontally scrollable table shell — admin tables are wide on phones. */
export function TableShell({
  headings,
  children,
}: {
  headings: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="border-rule overflow-x-auto border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-rule bg-paper border-b text-left">
            {headings.map((heading) => (
              <th key={heading} className="eyebrow text-dusty-text px-4 py-3 font-normal">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-dusty-text px-4 py-10 text-center text-sm">
        {children}
      </td>
    </tr>
  );
}
