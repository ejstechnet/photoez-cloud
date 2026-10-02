import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, photographers, sessionTypes } from "@/db/schema";
import { buildCalendar } from "@/lib/calendar-feed";
import { siteUrl } from "@/lib/site";

// A studio's private calendar link (Settings > Calendar): its bookings as an
// iCalendar feed that Google, Apple, and Outlook calendars subscribe to. The
// secret token in the address is the only key, so it's long and random, and
// the studio can reset it.
export async function GET(_request: Request, { params }: RouteContext<"/calendar/[token]">) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const [studio] = await db
    .select({ id: photographers.id, name: photographers.name, businessName: photographers.businessName })
    .from(photographers)
    .where(eq(photographers.calendarToken, token));
  if (!studio) return new Response("Not found", { status: 404 });

  // Everything upcoming, and the last six months for reference.
  const since = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      id: bookings.id,
      sessionName: bookings.sessionName,
      title: bookings.title,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      clientName: bookings.clientName,
      clientEmail: bookings.clientEmail,
      clientPhone: bookings.clientPhone,
      notes: bookings.notes,
      location: sessionTypes.location,
    })
    .from(bookings)
    .leftJoin(sessionTypes, eq(sessionTypes.id, bookings.sessionTypeId))
    .where(
      and(eq(bookings.photographerId, studio.id), inArray(bookings.status, ["confirmed", "completed"]), gte(bookings.endsAt, since)),
    );

  const ics = buildCalendar(
    `${studio.businessName || studio.name} bookings`,
    rows.map((b) => ({
      id: b.id,
      title: `${b.title || b.sessionName} · ${b.clientName}`,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      location: b.location,
      description: [
        b.title ? `Session: ${b.sessionName}` : null,
        `Client: ${b.clientName}`,
        `Email: ${b.clientEmail}`,
        b.clientPhone ? `Phone: ${b.clientPhone}` : null,
        b.notes ? `Notes: ${b.notes}` : null,
        `Open in PhotoEZ Cloud: ${siteUrl}/dashboard/bookings/${b.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
      url: `${siteUrl}/dashboard/bookings/${b.id}`,
    })),
  );
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bookings.ics"',
      "Cache-Control": "private, no-store",
      // The link is private: keep it out of search engines.
      "X-Robots-Tag": "noindex",
    },
  });
}
