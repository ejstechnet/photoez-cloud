"use client";

import { useActionState, useState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form";
import { saveClientChanges } from "../actions";

// The studio's rules for clients rescheduling or cancelling from their
// booking link, without writing to the photographer.
export function ClientChangesForm({
  enabled,
  rescheduleNoticeHours,
  freeReschedules,
  cancelNoticeHours,
}: {
  enabled: boolean;
  rescheduleNoticeHours: number;
  freeReschedules: number;
  cancelNoticeHours: number;
}) {
  const [state, formAction, pending] = useActionState(saveClientChanges, {});
  const [on, setOn] = useState(enabled);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-start gap-3 rounded-xl border-2 border-border px-3.5 py-3">
        <input
          type="checkbox"
          name="clientChangesEnabled"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1 size-4 accent-lime-ink"
        />
        <span>
          <span className="block text-sm font-semibold">Let clients reschedule and cancel online</span>
          <span className="block text-xs text-muted">
            From the private link they get when they book. Turn off to have them contact you instead.
          </span>
        </span>
      </label>
      {on && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Reschedule notice (hours)"
            name="rescheduleNoticeHours"
            type="number"
            min={0}
            max={720}
            defaultValue={rescheduleNoticeHours}
            hint="Online rescheduling closes this long before the session."
          />
          <Field
            label="Free reschedules"
            name="freeReschedules"
            type="number"
            min={0}
            max={10}
            defaultValue={freeReschedules}
            hint="After these, clients contact you."
          />
          <Field
            label="Cancel notice for credit (hours)"
            name="cancelNoticeHours"
            type="number"
            min={0}
            max={720}
            defaultValue={cancelNoticeHours}
            hint="Cancel earlier than this and the deposit becomes a credit."
          />
        </div>
      )}
      {!on && (
        <>
          <input type="hidden" name="rescheduleNoticeHours" value={rescheduleNoticeHours} />
          <input type="hidden" name="freeReschedules" value={freeReschedules} />
          <input type="hidden" name="cancelNoticeHours" value={cancelNoticeHours} />
        </>
      )}
      <FormError message={state.message} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending} fullWidth={false}>
          Save rules
        </SubmitButton>
        {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
      </div>
    </form>
  );
}
