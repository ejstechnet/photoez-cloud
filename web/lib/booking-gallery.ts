import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, galleries, photographers, sessionTypes } from "@/db/schema";
import { galleryLimitError } from "@/lib/plan-usage";
import { bookingGalleryTitle } from "@/lib/booking-gallery-title";

// Like PhotoEZ Booking's create_gallery_from_booking: when a booking is
// confirmed (right away, or once its deposit is paid), a proofing gallery is
// made for it, unless its session type says "no gallery". It waits in
// Proofing, unshared and with no email to the client, until photos are
// uploaded. A booking never gets two galleries (galleries.booking_id is
// unique), so this is safe to call more than once.

export type BookingGalleryResult =
  | { created: true; galleryId: string }
  | { created: false; reason: "exists"; galleryId: string }
  | { created: false; reason: "not_confirmed" | "no_gallery" | "missing" }
  | { created: false; reason: "plan_limit"; message: string };

export async function createGalleryForBooking(
  bookingId: string,
  // The photographer's "Create gallery" button makes one even for sessions
  // set to "no gallery".
  options: { manual?: boolean } = {},
): Promise<BookingGalleryResult> {
  const [row] = await db
    .select({
      booking: bookings,
      galleryType: sessionTypes.galleryType,
      photosIncluded: sessionTypes.photosIncluded,
      timeZone: photographers.timeZone,
    })
    .from(bookings)
    .innerJoin(photographers, eq(photographers.id, bookings.photographerId))
    .leftJoin(sessionTypes, eq(sessionTypes.id, bookings.sessionTypeId))
    .where(eq(bookings.id, bookingId));
  if (!row) return { created: false, reason: "missing" };
  const { booking } = row;

  const [existing] = await db.select({ id: galleries.id }).from(galleries).where(eq(galleries.bookingId, bookingId));
  if (existing) return { created: false, reason: "exists", galleryId: existing.id };
  if (!options.manual) {
    if (booking.status !== "confirmed") return { created: false, reason: "not_confirmed" };
    if (row.galleryType === "none") return { created: false, reason: "no_gallery" };
  }
  const limit = await galleryLimitError(booking.photographerId);
  if (limit) return { created: false, reason: "plan_limit", message: limit };

  const [gallery] = await db
    .insert(galleries)
    .values({
      photographerId: booking.photographerId,
      clientId: booking.clientId,
      bookingId,
      // The client's session title from the booking form, like PhotoEZ Booking;
      // bookings from before that field get "Session · Client · date".
      title: booking.title || bookingGalleryTitle(booking.sessionName, booking.clientName, booking.startsAt, row.timeZone),
      // The session's included photos; otherwise the usual default.
      ...(row.photosIncluded !== null ? { freeLimit: row.photosIncluded } : {}),
      shareToken: randomBytes(18).toString("base64url"),
    })
    .onConflictDoNothing({ target: galleries.bookingId })
    .returning({ id: galleries.id });
  if (!gallery) {
    // Another request made it at the same moment.
    const [made] = await db.select({ id: galleries.id }).from(galleries).where(eq(galleries.bookingId, bookingId));
    return made ? { created: false, reason: "exists", galleryId: made.id } : { created: false, reason: "missing" };
  }
  return { created: true, galleryId: gallery.id };
}
