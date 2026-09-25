"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, FormError } from "@/components/form";
import { addTimeOff } from "../actions";

// Adds a day off, or a range of days (vacations, holidays).
export function TimeOffForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(addTimeOff, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful add.
  useEffect(() => {
    if (!pending && !state.message) formRef.current?.reset();
  }, [state, pending]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <Field label="First day" name="startDate" type="date" min={today} required />
        <Field label="Last day" name="endDate" type="date" min={today} hint="Blank = one day" />
        <Field label="Note" name="note" placeholder="Vacation" hint="Only you see this." />
        <button type="submit" disabled={pending} className="btn-primary mb-6 sm:mb-[1.4rem]">
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <FormError message={state.message} />
    </form>
  );
}
