import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contractTemplates, photographers, sessionTypes, signedContracts } from "@/db/schema";
import { depositCents, formatPrice } from "@/lib/booking/format";
import { formatDate, formatTime, zoneLabel } from "@/lib/booking/time";
import { sanitizeRichText } from "@/lib/rich-text";
import { bookingTotal } from "@/lib/payments/amounts";
import { fillPlaceholders } from "./placeholders";

type BookingForContract = {
  id: string;
  photographerId: string;
  sessionTypeId: string | null;
  sessionName: string;
  priceCents: number;
  addonsCents: number;
  discountCents: number;
  depositPercent: number;
  startsAt: Date;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
};

// The contract a booking should be signed with: the session's own choice,
// otherwise the studio default, or none. Null when no contract applies.
export async function contractTemplateFor(booking: BookingForContract) {
  let templateId: string | null = null;
  if (booking.sessionTypeId) {
    const [session] = await db
      .select({ contractTemplateId: sessionTypes.contractTemplateId, noContract: sessionTypes.noContract })
      .from(sessionTypes)
      .where(eq(sessionTypes.id, booking.sessionTypeId));
    if (session?.noContract) return null;
    templateId = session?.contractTemplateId ?? null;
  }
  const [template] = await db
    .select()
    .from(contractTemplates)
    .where(
      templateId
        ? and(eq(contractTemplates.id, templateId), eq(contractTemplates.photographerId, booking.photographerId))
        : and(eq(contractTemplates.photographerId, booking.photographerId), eq(contractTemplates.isDefault, true)),
    )
    .limit(1);
  return template ?? null;
}

// The template's text with this booking's details filled in, ready to sign.
export async function filledContract(booking: BookingForContract, template: { content: string }) {
  const [studio] = await db
    .select({
      name: photographers.name,
      businessName: photographers.businessName,
      email: photographers.email,
      timeZone: photographers.timeZone,
    })
    .from(photographers)
    .where(eq(photographers.id, booking.photographerId));
  const tz = studio.timeZone;
  const total = bookingTotal(booking);
  const deposit = depositCents(total, booking.depositPercent);
  return sanitizeRichText(
    fillPlaceholders(template.content, {
      CLIENT_NAME: booking.clientName,
      CLIENT_EMAIL: booking.clientEmail,
      CLIENT_PHONE: booking.clientPhone ?? "Not given",
      SESSION_NAME: booking.sessionName,
      BOOKING_DATE: formatDate(booking.startsAt, tz),
      BOOKING_TIME: `${formatTime(booking.startsAt, tz)} ${zoneLabel(booking.startsAt, tz)}`,
      PHOTOGRAPHER_NAME: studio.name,
      STUDIO_NAME: studio.businessName ?? studio.name,
      STUDIO_EMAIL: studio.email,
      TOTAL_AMOUNT: formatPrice(total),
      DEPOSIT_AMOUNT: formatPrice(deposit),
      BALANCE_DUE: formatPrice(total - deposit),
      TODAY_DATE: formatDate(new Date(), tz).replace(/^\w+, /, ""),
    }),
  );
}

export async function signedContractFor(bookingId: string) {
  const [signed] = await db.select().from(signedContracts).where(eq(signedContracts.bookingId, bookingId));
  return signed ?? null;
}
