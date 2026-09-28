// The booking form's progress, like PhotoEZ Booking's step form: Session →
// Date → Time → Extras (only when the session has add-ons) → Your details.
// One step shows at a time; finished steps get a check.

export type BookingStepKey = "session" | "date" | "time" | "extras" | "details";

const LABELS: Record<BookingStepKey, string> = {
  session: "Session",
  date: "Date",
  time: "Time",
  extras: "Extras",
  details: "Your details",
};

export function bookingStepList(hasExtras: boolean): BookingStepKey[] {
  return hasExtras ? ["session", "date", "time", "extras", "details"] : ["session", "date", "time", "details"];
}

export function BookingSteps({ current, hasExtras }: { current: BookingStepKey; hasExtras: boolean }) {
  const steps = bookingStepList(hasExtras);
  const at = steps.indexOf(current);
  return (
    <nav aria-label="Booking steps">
      {/* Phones: one line. */}
      <p className="text-sm font-bold tracking-wider text-muted uppercase sm:hidden">
        Step {at + 1} of {steps.length} · <span className="text-foreground">{LABELS[current]}</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border sm:hidden">
        <div className="h-full rounded-full bg-lime" style={{ width: `${((at + 1) / steps.length) * 100}%` }} />
      </div>
      {/* Wider screens: every step. */}
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((step, i) => (
          <li key={step} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              aria-current={i === at ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap uppercase ${
                i < at ? "bg-lime/20 text-lime-ink" : i === at ? "bg-brand text-white" : "bg-border/60 text-muted"
              }`}
            >
              <span
                className={`grid size-5 place-items-center rounded-full text-[11px] ${
                  i < at ? "bg-lime text-on-accent" : i === at ? "bg-white text-brand" : "bg-surface text-muted"
                }`}
              >
                {i < at ? "✓" : i + 1}
              </span>
              {LABELS[step]}
            </span>
            {i < steps.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < at ? "bg-lime" : "bg-border"}`} aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
