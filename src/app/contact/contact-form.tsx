"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field, TextAreaField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { submitContact, type ContactState } from "@/app/actions/contact";

const initial: ContactState = { status: "idle" };

export function ContactForm() {
  const [state, action] = useActionState(submitContact, initial);

  if (state.status === "success") {
    return (
      <div className="border-rule border p-8 text-center" role="status">
        <p className="font-display text-2xl font-light">Thank you</p>
        <p className="mt-3 text-sm opacity-80">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Honeypot — visually hidden, never announced, never tabbable. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="website">Leave this empty</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Your name" name="name" required error={state.fieldErrors?.name} />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        error={state.fieldErrors?.email}
      />
      <Field
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        error={state.fieldErrors?.phone}
      />

      <div>
        <label htmlFor="collection" className="eyebrow text-dusty-text mb-1.5 block">
          What are you after?
        </label>
        <select
          id="collection"
          name="collection"
          defaultValue="Bridal"
          className="bg-paper border-rule text-mocha focus:border-mocha focus:outline-mocha w-full rounded-none border px-3.5 py-3 text-sm font-light focus:outline-2 focus:outline-offset-2"
        >
          {["Bridal", "Evening", "Bespoke", "Just curious"].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <Field
        label="Wedding or event date"
        name="eventDate"
        type="date"
        hint="If you know it."
      />

      <TextAreaField
        label="Your message"
        name="message"
        required
        rows={5}
        error={state.fieldErrors?.message}
      />

      {state.status === "error" && state.message && (
        <p role="alert" className="text-error text-sm">
          {state.message}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-2">
      {pending ? "Sending…" : "Send enquiry"}
    </Button>
  );
}
