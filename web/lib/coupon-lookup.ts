import { and, count, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, coupons } from "@/db/schema";
import { checkCoupon, type CouponCheck } from "@/lib/coupons";

// Looks up a studio's coupon code and checks it for a booking, counting the
// bookings (not cancelled) that already used it, overall and by this client's email.
export async function checkCouponCode(
  photographerId: string,
  sessionTypeId: string,
  code: string,
  totalCents: number,
  today: string,
  clientEmail?: string,
): Promise<CouponCheck> {
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.photographerId, photographerId), eq(coupons.code, code)));
  const [{ uses }] = await db
    .select({ uses: count() })
    .from(bookings)
    .where(
      and(eq(bookings.photographerId, photographerId), eq(bookings.couponCode, code), ne(bookings.status, "cancelled")),
    );
  let clientUses = 0;
  if (clientEmail) {
    [{ clientUses }] = await db
      .select({ clientUses: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.photographerId, photographerId),
          eq(bookings.couponCode, code),
          ne(bookings.status, "cancelled"),
          sql`lower(${bookings.clientEmail}) = lower(${clientEmail.trim()})`,
        ),
      );
  }
  return checkCoupon(coupon ?? null, { sessionTypeId, totalCents, today, uses, clientUses });
}
