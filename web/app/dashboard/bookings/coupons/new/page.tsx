import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionTypes } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { addCoupon } from "../../coupon-actions";
import { CouponForm } from "../../coupon-form";

export default async function NewCouponPage() {
  const user = await requirePhotographer();
  const sessions = await db
    .select({ id: sessionTypes.id, name: sessionTypes.name })
    .from(sessionTypes)
    .where(eq(sessionTypes.photographerId, user.id))
    .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt));
  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup#coupons" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to coupons
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">New coupon</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <CouponForm action={addCoupon} sessions={sessions} submitLabel="Add coupon" />
      </div>
    </div>
  );
}
