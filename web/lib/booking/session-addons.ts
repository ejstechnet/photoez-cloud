import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addons, bookingAddons, sessionTypeAddons } from "@/db/schema";
import { signedViewUrl } from "@/lib/storage";

// The add-ons a session offers, in the studio's order, with how many come
// with the session. Used by the booking page and re-checked by createBooking.
export async function offeredAddons(sessionTypeId: string) {
  return db
    .select({
      id: addons.id,
      name: addons.name,
      description: addons.description,
      priceCents: addons.priceCents,
      maxQuantity: addons.maxQuantity,
      imageKey: addons.imageKey,
      includedQuantity: sessionTypeAddons.includedQuantity,
    })
    .from(sessionTypeAddons)
    .innerJoin(addons, eq(addons.id, sessionTypeAddons.addonId))
    .where(eq(sessionTypeAddons.sessionTypeId, sessionTypeId))
    .orderBy(asc(addons.sortOrder), asc(addons.createdAt));
}

// Same, with a viewable link for each add-on's photo.
export async function addonsForSession(sessionTypeId: string) {
  const rows = await offeredAddons(sessionTypeId);
  return Promise.all(
    rows.map(async ({ imageKey, ...addon }) => ({
      ...addon,
      photoUrl: imageKey ? await signedViewUrl(imageKey) : null,
    })),
  );
}

// The extras saved on a booking, for the client's page and the dashboard.
export async function bookingExtras(bookingId: string) {
  return db
    .select({
      id: bookingAddons.id,
      name: bookingAddons.name,
      priceCents: bookingAddons.priceCents,
      quantity: bookingAddons.quantity,
    })
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, bookingId));
}
