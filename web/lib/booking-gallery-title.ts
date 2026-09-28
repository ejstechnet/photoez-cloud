// "Family Session · Maya Brooks · Oct 3, 2026": a booking's gallery title,
// with the session's day in the studio's time zone (lib/booking-gallery.ts).
// Tested in booking-gallery-title.test.ts.
export function bookingGalleryTitle(sessionName: string, clientName: string, startsAt: Date, timeZone: string) {
  const day = startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
  return `${sessionName} · ${clientName} · ${day}`.slice(0, 200);
}
