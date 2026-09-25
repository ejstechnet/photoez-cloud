"use client";

import { useActionState, useState } from "react";
import { Field, FormError, SelectField, SubmitButton, inputClass } from "@/components/form";
import { DAY_NAMES } from "@/lib/booking/format";
import { saveAvailability } from "../actions";

type DayHours = { open: boolean; start: string; end: string };

const COMMON_ZONES: [string, string][] = [
  ["America/Los_Angeles", "Pacific Time"],
  ["America/Denver", "Mountain Time"],
  ["America/Phoenix", "Arizona"],
  ["America/Chicago", "Central Time"],
  ["America/New_York", "Eastern Time"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
];

// Time zone, minimum notice, buffer, and weekly hours: the rules the booking
// page uses to offer times. Same settings as PhotoEZ Booking's Availability tab.
export function AvailabilityForm({
  timeZone,
  minNoticeDays,
  bufferMinutes,
  days,
  allZones,
}: {
  timeZone: string;
  minNoticeDays: number;
  bufferMinutes: number;
  days: DayHours[];
  allZones: string[];
}) {
  const [state, formAction, pending] = useActionState(saveAvailability, {});
  const [open, setOpen] = useState(days.map((d) => d.open));
  const common = new Set(COMMON_ZONES.map(([zone]) => zone));

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Time zone" name="timeZone" defaultValue={timeZone}>
          <optgroup label="United States">
            {COMMON_ZONES.map(([zone, label]) => (
              <option key={zone} value={zone}>
                {label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Everywhere">
            {allZones
              .filter((zone) => !common.has(zone))
              .map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
          </optgroup>
        </SelectField>
        <Field
          label="Minimum notice (days)"
          name="minNoticeDays"
          type="number"
          min={0}
          max={365}
          defaultValue={minNoticeDays}
          hint="1 = clients can book from tomorrow."
        />
        <Field
          label="Buffer (minutes)"
          name="bufferMinutes"
          type="number"
          min={0}
          max={240}
          step={5}
          defaultValue={bufferMinutes}
          hint="Kept free between sessions."
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Weekly hours</legend>
        <ul className="mt-2 divide-y divide-border rounded-2xl border-2 border-border">
          {days.map((day, i) => (
            <li key={DAY_NAMES[i]} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <label className="flex w-36 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  name={`day${i}.open`}
                  checked={open[i]}
                  onChange={(e) => setOpen(open.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="size-4 accent-lime-ink"
                />
                {DAY_NAMES[i]}
              </label>
              {open[i] ? (
                <span className="flex items-center gap-2">
                  <input
                    type="time"
                    name={`day${i}.start`}
                    defaultValue={day.start}
                    aria-label={`${DAY_NAMES[i]} opens`}
                    className={`${inputClass} w-auto py-1.5`}
                  />
                  <span className="text-sm text-muted">to</span>
                  <input
                    type="time"
                    name={`day${i}.end`}
                    defaultValue={day.end}
                    aria-label={`${DAY_NAMES[i]} closes`}
                    className={`${inputClass} w-auto py-1.5`}
                  />
                </span>
              ) : (
                <span className="text-sm text-muted">Closed</span>
              )}
            </li>
          ))}
        </ul>
      </fieldset>

      <FormError message={state.message} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending} fullWidth={false}>
          Save hours
        </SubmitButton>
        {state.saved && !pending && <span className="text-sm font-semibold text-lime-ink">Saved</span>}
      </div>
    </form>
  );
}
