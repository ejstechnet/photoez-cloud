// What's owed counts what clients have already paid. Guards the Drizzle trap
// where ${table.column} inside a selected subquery of a one-table select
// renders as a bare "id" (read by Postgres as payments.id), so nothing ever
// looked paid. Runs against the in-memory Postgres (test/db.ts).
//   npm test
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { galleries, payments } from "@/db/schema";
import { makeStudio } from "../test/assistant-fixtures.ts";
import { calendarBookings } from "./booking/month-bookings";
import { dashboardStats } from "./dashboard-stats";

type Paying = { bookingId?: string; galleryId?: string; kind: "deposit" | "gallery_extras"; amountCents: number; status?: "pending" | "paid" };

async function pay(p: Paying) {
  await db.insert(payments).values({
    status: "paid",
    ...p,
    stripeAccountId: "acct_test",
    stripeCheckoutSessionId: `cs_test_${randomUUID()}`,
  });
}

// A studio whose $200 booking has a $50 deposit paid (plus a checkout left
// pending), and another studio's payment that mustn't be counted for it.
async function paidStudio() {
  const s = await makeStudio();
  await pay({ bookingId: s.booking.id, kind: "deposit", amountCents: 5000 });
  await pay({ bookingId: s.booking.id, kind: "deposit", amountCents: 9900, status: "pending" });
  const other = await makeStudio("Other Studio");
  await pay({ bookingId: other.booking.id, kind: "deposit", amountCents: 7000 });
  return s;
}

test("Overview balances owed subtract what's been paid on bookings and gallery extras", async () => {
  const s = await paidStudio();
  // $30 of extras paid in full, and $20 of extras with $5 paid.
  await db.update(galleries).set({ extrasCents: 3000 }).where(eq(galleries.id, s.gallery.id));
  await pay({ galleryId: s.gallery.id, kind: "gallery_extras", amountCents: 3000 });
  const [partly] = await db
    .insert(galleries)
    .values({ photographerId: s.studio.id, clientId: s.clients[0].id, title: "Extras owed", shareToken: randomUUID(), status: "delivered", extrasCents: 2000 })
    .returning();
  await pay({ galleryId: partly.id, kind: "gallery_extras", amountCents: 500 });

  const stats = await dashboardStats(s.studio.id, s.studio.timeZone, "all");
  // $150 left on the booking + $15 left on the extras.
  assert.equal(stats.revenue.owedCents, 15000 + 1500);
});

test("Bookings calendar shows each session's paid amount", async () => {
  const s = await paidStudio();
  const from = new Date(s.booking.startsAt.getTime() - 60 * 60 * 1000);
  const to = new Date(s.booking.endsAt.getTime() + 60 * 60 * 1000);
  const rows = await calendarBookings(s.studio.id, from, to);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].booking.id, s.booking.id);
  assert.equal(rows[0].paidCents, 5000);
});
