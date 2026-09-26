// Coupon codes: whether a code works for a booking, and how much it takes
// off the whole total (session + extras). Pure logic, tested in coupons.test.ts.

export type Coupon = {
  code: string;
  kind: "percent" | "amount";
  value: number; // percent 1-100, or cents
  sessionTypeIds: string[];
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  maxUsesPerClient: number | null;
  active: boolean;
};

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export function couponDiscount(coupon: Pick<Coupon, "kind" | "value">, totalCents: number) {
  const off = coupon.kind === "percent" ? Math.round((totalCents * coupon.value) / 100) : coupon.value;
  return Math.min(totalCents, Math.max(0, off));
}

export type CouponCheck = { ok: true; discountCents: number } | { ok: false; message: string };

// `uses` counts bookings already made with the code, `clientUses` those made by
// this client (by email; unknown until they've typed it); `today` is the studio's own date.
export function checkCoupon(
  coupon: Coupon | null,
  booking: { sessionTypeId: string; totalCents: number; today: string; uses: number; clientUses?: number },
): CouponCheck {
  if (!coupon || !coupon.active) return { ok: false, message: "That code isn't valid." };
  if (coupon.startsOn && booking.today < coupon.startsOn) return { ok: false, message: "That code isn't active yet." };
  if (coupon.endsOn && booking.today > coupon.endsOn) return { ok: false, message: "That code has expired." };
  if (coupon.sessionTypeIds.length > 0 && !coupon.sessionTypeIds.includes(booking.sessionTypeId)) {
    return { ok: false, message: "That code doesn't work for this session." };
  }
  if (coupon.maxUses !== null && booking.uses >= coupon.maxUses) {
    return { ok: false, message: "That code has been used up." };
  }
  if (coupon.maxUsesPerClient !== null && (booking.clientUses ?? 0) >= coupon.maxUsesPerClient) {
    return {
      ok: false,
      message:
        coupon.maxUsesPerClient === 1 ? "You've already used this code." : "You've used this code as many times as it allows.",
    };
  }
  return { ok: true, discountCents: couponDiscount(coupon, booking.totalCents) };
}
