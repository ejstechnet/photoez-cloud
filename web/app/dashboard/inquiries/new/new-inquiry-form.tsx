"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, TextAreaField } from "@/components/form";
import { SparklesIcon } from "@/components/icons";
import { createInquiry } from "../actions";

export function NewInquiryForm() {
  const [state, formAction, pending] = useActionState(createInquiry, {});
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <TextAreaField
        label="The inquiry"
        name="message"
        rows={12}
        required
        error={errors.message}
        placeholder={"Hi! We just got engaged and would love photos in the fall…"}
        hint="Paste the whole email or contact-form message, including their signature."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sender name" name="fromName" error={errors.fromName} hint="Optional, if it's not in the message" />
        <Field
          label="Sender email"
          name="fromEmail"
          type="email"
          error={errors.fromEmail}
          hint="Optional, from the email header"
        />
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
          <SparklesIcon size={18} />
          {pending ? "Reading the inquiry…" : "Triage with AI"}
        </button>
        <Link
          href="/dashboard/inquiries"
          className="text-center text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
      {pending && (
        <p role="status" className="text-sm text-muted">
          This usually takes 10–20 seconds.
        </p>
      )}
    </form>
  );
}
