import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, coupons, sessionTypes } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { ConfirmButton } from "../../confirm-button";
import { deleteCoupon, updateCoupon } from "../../coupon-actions";
import { CouponForm } from "../../coupon-form";

export default async function EditCouponPage({ params }: PageProps<"/dashboard/bookings/coupons/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.id, id), eq(coupons.photographerId, user.id)));
  if (!coupon) notFound();
  const [sessions, [{ uses }]] = await Promise.all([
    db
      .select({ id: sessionTypes.id, name: sessionTypes.name })
      .from(sessionTypes)
      .where(eq(sessionTypes.photographerId, user.id))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
    db
      .select({ uses: count() })
      .from(bookings)
      .where(and(eq(bookings.photographerId, user.id), eq(bookings.couponCode, coupon.code), ne(bookings.status, "cancelled"))),
  ]);

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup#coupons" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to coupons
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{coupon.code}</h1>
      <p className="mt-1 text-muted">
        Used on {uses} {uses === 1 ? "booking" : "bookings"}
        {coupon.maxUses !== null ? ` of ${coupon.maxUses}` : ""}.
      </p>
      <div className="card mt-8 p-6 sm:p-8">
        <CouponForm action={updateCoupon.bind(null, coupon.id)} sessions={sessions} defaultValues={coupon} submitLabel="Save changes" />
      </div>
      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this coupon</p>
          <p className="text-sm text-muted">Bookings that used it keep their discount. To pause it instead, untick Active.</p>
        </div>
        <ConfirmButton
          action={deleteCoupon.bind(null, coupon.id)}
          confirmText={`Delete ${coupon.code}? This can't be undone.`}
          pendingLabel="Deleting…"
          danger
        >
          Delete coupon
        </ConfirmButton>
      </div>
    </div>
  );
}
