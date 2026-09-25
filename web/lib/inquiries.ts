import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookingHours, inquiries, photographers, sessionTypes, studioFaqs } from "@/db/schema";
import { triageInquiry, type StudioContext } from "@/lib/ai/triage";
import { richTextToPlain } from "@/lib/rich-text";
import { LOCATION_LABELS, SESSION_LABELS, type SessionType, type ShootLocation } from "@/lib/session-types";
import { siteUrl } from "@/lib/site";

// What triage should know about this studio: its profile and client FAQ, plus
// the booking page and its sessions when online booking is open (sessions +
// hours saved).
export async function studioContext(photographerId: string): Promise<StudioContext> {
  const [[studio], sessions, [hours], faqs] = await Promise.all([
    db
      .select({
        slug: photographers.studioSlug,
        serviceArea: photographers.serviceArea,
        offeredTypes: photographers.offeredTypes,
        quoteOnlyTypes: photographers.quoteOnlyTypes,
        shootLocations: photographers.shootLocations,
      })
      .from(photographers)
      .where(eq(photographers.id, photographerId)),
    db
      .select({
        name: sessionTypes.name,
        durationMinutes: sessionTypes.durationMinutes,
        location: sessionTypes.location,
        photosIncluded: sessionTypes.photosIncluded,
        shortDescription: sessionTypes.shortDescription,
        description: sessionTypes.description,
      })
      .from(sessionTypes)
      .where(and(eq(sessionTypes.photographerId, photographerId), eq(sessionTypes.hidden, false)))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
    db.select({ id: bookingHours.id }).from(bookingHours).where(eq(bookingHours.photographerId, photographerId)).limit(1),
    db
      .select({ question: studioFaqs.question, answer: studioFaqs.answer })
      .from(studioFaqs)
      .where(eq(studioFaqs.photographerId, photographerId))
      .orderBy(asc(studioFaqs.sortOrder)),
  ]);
  const label = (type: string) => SESSION_LABELS[type as SessionType]?.toLowerCase() ?? type;
  const bookingOpen = Boolean(studio.slug && hours && sessions.length > 0);
  return {
    serviceArea: studio.serviceArea,
    shootLocations: studio.shootLocations.map((place) => LOCATION_LABELS[place as ShootLocation]?.toLowerCase() ?? place),
    offered: studio.offeredTypes.map(label),
    quoteOnly: studio.quoteOnlyTypes.map(label),
    bookableSessions: bookingOpen
      ? sessions.map((s) => ({
          name: s.name,
          durationMinutes: s.durationMinutes,
          location: s.location ? (LOCATION_LABELS[s.location as ShootLocation]?.toLowerCase() ?? s.location) : null,
          photosIncluded: s.photosIncluded,
          // Plain text, kept short so a long description can't crowd out the rest.
          description:
            [s.shortDescription, s.description ? richTextToPlain(s.description) : null]
              .filter(Boolean)
              .join(" ")
              .slice(0, 800) || null,
        }))
      : [],
    bookingUrl: bookingOpen ? `${siteUrl}/studio/${studio.slug}/book` : null,
    faqs,
  };
}

// Run AI triage on a saved inquiry and store the result, or the error, so an
// inquiry is never lost just because the AI step failed. Used by both the
// photographer's "New inquiry" form and the public studio page form.
export async function runTriage(
  inquiry: { id: string; message: string; fromName: string | null; fromEmail: string | null },
  photographer: { id: string; name: string; businessName?: string | null },
) {
  try {
    const run = await triageInquiry({
      message: inquiry.message,
      fromName: inquiry.fromName,
      fromEmail: inquiry.fromEmail,
      photographerName: photographer.name,
      studioName: photographer.businessName ?? null,
      studio: await studioContext(photographer.id),
      today: new Date(),
    });
    await db
      .update(inquiries)
      .set({
        triage: run.result,
        triageError: null,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        triagedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiry.id));
  } catch (error) {
    console.error("Inquiry triage failed", error);
    await db
      .update(inquiries)
      .set({
        triageError:
          error instanceof Error && error.message.startsWith("The AI")
            ? error.message
            : "The AI couldn't read this inquiry right now. Try again in a minute.",
      })
      .where(eq(inquiries.id, inquiry.id));
  }
}
