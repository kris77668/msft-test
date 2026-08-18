"use client";

import { useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Form field — label, control, error, in one accessible unit.
 *
 * The prototype's forms were almost entirely uncontrolled and unvalidated: all
 * twelve checkout fields discarded every keystroke and you could complete an
 * order with a blank form. Its labels were <span>s, not <label>s, so clicking
 * one did nothing and screen readers announced an unlabelled textbox.
 *
 * Here: a real <label for>, `aria-invalid` and `aria-describedby` wired to the
 * message, and errors announced via role="alert". Errors use `error`
 * (#bd4d46, 4.52:1) rather than the prototype's #c14f47, which measured 4.35:1
 * and failed AA for the small text errors are always rendered in.
 */

const CONTROL =
  // min-h-11 guarantees a 44px tap target — date and select controls render
  // shorter than text inputs on mobile Safari and fall below it otherwise.
  "w-full min-h-11 bg-paper border border-rule px-3.5 py-3 text-sm font-light text-mocha " +
  "placeholder:text-mocha/40 rounded-none transition-colors " +
  "focus:border-mocha focus:outline-2 focus:outline-offset-2 focus:outline-mocha " +
  "aria-[invalid=true]:border-error";

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
}

function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return { id, errorId, hintId, describedBy: describedBy || undefined };
}

function Shell({
  label,
  error,
  hint,
  required,
  className,
  id,
  errorId,
  hintId,
  children,
}: FieldShellProps & {
  id: string;
  errorId: string;
  hintId: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("block", className)}>
      <label htmlFor={id} className="eyebrow text-dusty-text mb-1.5 block">
        {label}
        {required && (
          <span className="text-error ml-1" aria-hidden>
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p id={hintId} className="text-dusty-text mt-1.5 text-xs">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-error mt-1.5 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export type FieldProps = FieldShellProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export function Field({ label, error, hint, required, className, ...rest }: FieldProps) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint);

  return (
    <Shell
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      id={id}
      errorId={errorId}
      hintId={hintId}
    >
      <input
        id={id}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
    </Shell>
  );
}

export type TextAreaFieldProps = FieldShellProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">;

export function TextAreaField({
  label,
  error,
  hint,
  required,
  className,
  rows = 4,
  ...rest
}: TextAreaFieldProps) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint);

  return (
    <Shell
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
      id={id}
      errorId={errorId}
      hintId={hintId}
    >
      <textarea
        id={id}
        rows={rows}
        className={clsx(CONTROL, "resize-y")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        {...rest}
      />
    </Shell>
  );
}
