// Display helpers for booking: money is stored in cents, lengths in minutes.

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  const h = hours === 1 ? "1 hr" : `${hours} hrs`;
  return rest === 0 ? h : `${h} ${rest} min`;
}

export function depositCents(priceCents: number, depositPercent: number) {
  return Math.round((priceCents * depositPercent) / 100);
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
