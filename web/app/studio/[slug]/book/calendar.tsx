import Link from "next/link";
import { dayOfWeek } from "@/lib/booking/time";

// Month calendar for picking a day: open days are links, the rest are greyed
// out. Used by the booking page and the client's reschedule page.

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function Calendar({
  month,
  openDates,
  selected,
  prevHref,
  nextHref,
  dayHref,
}: {
  month: string;
  openDates: string[];
  selected: string | null;
  prevHref: string | null;
  nextHref: string | null;
  dayHref: (date: string) => string;
}) {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array<null>(dayOfWeek(first)).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  const arrow = "grid size-9 place-items-center rounded-full border-2 border-border font-bold transition";

  return (
    <div>
      <div className="flex items-center justify-between">
        {prevHref ? (
          <Link href={prevHref} scroll={false} className={`${arrow} hover:border-lime-ink`} aria-label="Previous month">
            ‹
          </Link>
        ) : (
          <span className={`${arrow} opacity-30`} aria-hidden="true">
            ‹
          </span>
        )}
        <p className="font-display text-lg font-bold">{label}</p>
        {nextHref ? (
          <Link href={nextHref} scroll={false} className={`${arrow} hover:border-lime-ink`} aria-label="Next month">
            ›
          </Link>
        ) : (
          <span className={`${arrow} opacity-30`} aria-hidden="true">
            ›
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-xs font-bold text-muted">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`blank-${i}`} />;
          const day = Number(d.slice(8));
          if (!openDates.includes(d)) {
            return (
              <span key={d} className="grid aspect-square place-items-center rounded-full text-sm text-muted/50">
                {day}
              </span>
            );
          }
          const isSelected = d === selected;
          return (
            <Link
              key={d}
              href={dayHref(d)}
              scroll={false}
              aria-current={isSelected ? "date" : undefined}
              className={`grid aspect-square place-items-center rounded-full text-sm font-bold transition ${
                isSelected ? "bg-brand text-white" : "bg-lime/20 text-lime-ink hover:bg-lime hover:text-brand-deep"
              }`}
            >
              {day}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
