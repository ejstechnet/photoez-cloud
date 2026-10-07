import { and, asc, count, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, clients, galleries, giftCards, inquiries, invoices, payments, reviews, storeOrders } from "@/db/schema";
import { contractTemplateFor, signedContractFor } from "@/lib/contracts/for-booking";
import { bookingTotal, prepaid } from "@/lib/payments/amounts";
import { monthRange, periodStart, type Period } from "@/lib/dashboard-periods";

// Everything the dashboard overview shows, like PhotoEZ for WordPress's
// dashboard: revenue, gallery and booking counts, what needs attention, and
// the next sessions. Revenue counts payments made online through Stripe.

const DAY = 24 * 60 * 60 * 1000;
// How far ahead an unpaid balance or unsigned contract needs attention.
const SOON_DAYS = 14;

export async function dashboardStats(photographerId: string, timeZone: string, period: Period, now = new Date()) {
  const start = periodStart(period, now, timeZone);
  const month = monthRange(now, timeZone);
  const owner = sql`coalesce(${bookings.photographerId}, ${galleries.photographerId}, ${giftCards.photographerId}, ${storeOrders.photographerId}, ${invoices.photographerId}) = ${photographerId}`;

  const [revenueRows, galleryRows, readyRows, bookingCounts, inquiryCounts, [{ toApprove }], [{ clientCount }], openBookings, owedGalleries] =
    await Promise.all([
      // Revenue by kind in the period.
      db
        .select({ kind: payments.kind, cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
        .from(payments)
        .leftJoin(bookings, eq(bookings.id, payments.bookingId))
        .leftJoin(galleries, eq(galleries.id, payments.galleryId))
        .leftJoin(giftCards, eq(giftCards.id, payments.giftCardId))
        .leftJoin(storeOrders, eq(storeOrders.id, payments.storeOrderId))
        .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
        .where(and(eq(payments.status, "paid"), owner, start ? gte(payments.paidAt, start) : undefined))
        .groupBy(payments.kind),
      // Galleries by stage.
      db
        .select({ status: galleries.status, n: count() })
        .from(galleries)
        .where(eq(galleries.photographerId, photographerId))
        .groupBy(galleries.status),
      // Picks are in: with finals uploaded (ready to deliver) or not yet.
      db
        .select({
          id: galleries.id,
          title: galleries.title,
          clientName: clients.name,
          finals: sql<number>`(select count(*) from photos where photos.gallery_id = ${galleries.id} and photos.kind = 'final')::int`,
        })
        .from(galleries)
        .leftJoin(clients, eq(clients.id, galleries.clientId))
        .where(and(eq(galleries.photographerId, photographerId), inArray(galleries.status, ["submitted", "paid_and_submitted"])))
        .orderBy(asc(galleries.submittedAt)),
      // Sessions coming up, and this calendar month.
      db
        .select({
          upcoming: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed' and ${bookings.startsAt} > ${now.toISOString()}::timestamptz)::int`,
          thisMonth: sql<number>`count(*) filter (where ${bookings.status} in ('confirmed', 'completed') and ${bookings.startsAt} >= ${month.start.toISOString()}::timestamptz and ${bookings.startsAt} < ${month.end.toISOString()}::timestamptz)::int`,
        })
        .from(bookings)
        .where(eq(bookings.photographerId, photographerId)),
      db
        .select({
          newCount: sql<number>`count(*) filter (where ${inquiries.status} = 'new')::int`,
          needsYou: sql<number>`count(*) filter (where ${inquiries.status} = 'new' and (${inquiries.triage}->>'needsPhotographer')::boolean is true)::int`,
        })
        .from(inquiries)
        .where(eq(inquiries.photographerId, photographerId)),
      db
        .select({ toApprove: count() })
        .from(reviews)
        .where(and(eq(reviews.photographerId, photographerId), eq(reviews.status, "submitted"))),
      db.select({ clientCount: count() }).from(clients).where(eq(clients.photographerId, photographerId)),
      // Confirmed bookings not yet finished, with what's been paid, for
      // balances owed and the upcoming list. The outer column is written out:
      // in a one-table select Drizzle renders ${bookings.id} as a bare "id",
      // which Postgres reads as payments.id.
      db
        .select({
          booking: bookings,
          paidCents: sql<number>`(select coalesce(sum(amount_cents), 0) from payments where payments.booking_id = bookings.id and payments.status = 'paid')::int`,
        })
        .from(bookings)
        .where(and(eq(bookings.photographerId, photographerId), eq(bookings.status, "confirmed")))
        .orderBy(asc(bookings.startsAt)),
      // Extra photos recorded as owed (studio without Stripe at the time).
      db
        .select({
          owed: sql<number>`coalesce(sum(greatest(${galleries.extrasCents} - (select coalesce(sum(amount_cents), 0) from payments where payments.gallery_id = galleries.id and payments.status = 'paid'), 0)), 0)::int`,
        })
        .from(galleries)
        .where(and(eq(galleries.photographerId, photographerId), gt(galleries.extrasCents, 0))),
    ]);

  const revenue = { booking: 0, gallery: 0, giftCards: 0, store: 0 };
  for (const row of revenueRows) {
    if (row.kind === "gallery_extras") revenue.gallery += row.cents;
    else if (row.kind === "gift_card") revenue.giftCards += row.cents;
    else if (row.kind === "store_order") revenue.store += row.cents;
    // Deposits, balances, and quote or invoice payments.
    else revenue.booking += row.cents;
  }

  const byStatus = Object.fromEntries(galleryRows.map((r) => [r.status, r.n])) as Record<string, number>;
  const galleryCounts = {
    total: galleryRows.reduce((sum, r) => sum + r.n, 0),
    proofing: byStatus.pending ?? 0,
    submitted: (byStatus.submitted ?? 0) + (byStatus.paid_and_submitted ?? 0),
    readyToDeliver: readyRows.filter((g) => g.finals > 0).length,
    delivered: (byStatus.delivered ?? 0) + (byStatus.completed ?? 0),
  };

  const withBalance = openBookings.map(({ booking, paidCents }) => ({
    booking,
    dueCents: Math.max(0, bookingTotal(booking) - paidCents - prepaid(booking)),
  }));
  const owedCents = withBalance.reduce((sum, b) => sum + b.dueCents, 0) + (owedGalleries[0]?.owed ?? 0);
  const upcoming = withBalance.filter((b) => b.booking.startsAt > now);
  const soon = upcoming.filter((b) => b.booking.startsAt.getTime() - now.getTime() < SOON_DAYS * DAY);

  // What needs the photographer, most urgent kinds first.
  type Action = { key: string; text: string; detail: string; href: string; tone: "lime" | "sun" | "coral" | "sky" };
  const actions: Action[] = [];
  for (const g of readyRows) {
    actions.push(
      g.finals > 0
        ? { key: `deliver-${g.id}`, text: `Deliver "${g.title}"`, detail: "Finals are uploaded", href: `/dashboard/galleries/${g.id}`, tone: "lime" }
        : {
            key: `finals-${g.id}`,
            text: `Upload finals for "${g.title}"`,
            detail: `${g.clientName ?? "The client"} submitted their picks`,
            href: `/dashboard/galleries/${g.id}`,
            tone: "sun",
          },
    );
  }
  for (const { booking, dueCents } of soon) {
    if (dueCents > 0) {
      actions.push({
        key: `balance-${booking.id}`,
        text: `Balance due from ${booking.clientName}`,
        detail: `${booking.sessionName}, ${Math.max(0, Math.ceil((booking.startsAt.getTime() - now.getTime()) / DAY))} days away`,
        href: `/dashboard/bookings/${booking.id}`,
        tone: "coral",
      });
    }
  }
  const contracts = await Promise.all(
    soon.slice(0, 10).map(async ({ booking }) => ({
      booking,
      unsigned: (await contractTemplateFor(booking)) !== null && !(await signedContractFor(booking.id)),
    })),
  );
  for (const { booking, unsigned } of contracts) {
    if (unsigned) {
      actions.push({
        key: `contract-${booking.id}`,
        text: `Contract not signed: ${booking.clientName}`,
        detail: booking.sessionName,
        href: `/dashboard/bookings/${booking.id}`,
        tone: "coral",
      });
    }
  }
  const inquiryRow = inquiryCounts[0] ?? { newCount: 0, needsYou: 0 };
  if (inquiryRow.needsYou > 0) {
    actions.push({
      key: "inquiries",
      text: `${inquiryRow.needsYou} ${inquiryRow.needsYou === 1 ? "inquiry needs" : "inquiries need"} you`,
      detail: "The AI flagged these for your personal reply",
      href: "/dashboard/inquiries",
      tone: "sky",
    });
  }
  if (toApprove > 0) {
    actions.push({
      key: "reviews",
      text: `${toApprove} new ${toApprove === 1 ? "review" : "reviews"} to approve`,
      detail: "They show on your studio page once approved",
      href: "/dashboard/reviews?show=submitted",
      tone: "sky",
    });
  }

  return {
    revenue: { ...revenue, total: revenue.booking + revenue.gallery + revenue.giftCards + revenue.store, owedCents },
    galleryCounts,
    bookingCounts: bookingCounts[0] ?? { upcoming: 0, thisMonth: 0 },
    newInquiries: inquiryRow.newCount,
    toApprove,
    clientCount,
    actions,
    nextSessions: upcoming.slice(0, 5),
  };
}

