"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { coupons, sessionTypes } from "@/db/schema";
import { normalizeCode } from "@/lib/coupons";
import { requirePhotographer } from "@/lib/session";

// Server actions for coupon codes. Each re-checks who is logged in and only
// touches that photographer's own coupons and sessions.

const isUuid = (value: string) => z.uuid().safeParse(value).success;
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type CouponFormState = { errors?: Partial<Record<string, string>>; message?: string };

async function parseCoupon(formData: FormData, photographerId: string) {
  const errors: Record<string, string> = {};
  const code = normalizeCode(text(formData, "code"));
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) errors.code = "Use 3–30 letters, numbers, dashes, or underscores.";

  const kind: "percent" | "amount" = text(formData, "kind") === "amount" ? "amount" : "percent";
  const raw = text(formData, "value").trim().replace(/[$,%]/g, "");
  let value = 0;
  if (kind === "percent") {
    value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 100) errors.value = "Enter a whole percent from 1 to 100.";
  } else {
    if (!/^\d{1,5}(\.\d{1,2})?$/.test(raw)) errors.value = "Enter an amount like 25 or 25.00.";
    else value = Math.round(Number(raw) * 100);
    if (value <= 0 && !errors.value) errors.value = "Enter an amount more than $0.";
  }

  const startsOn = text(formData, "startsOn") || null;
  const endsOn = text(formData, "endsOn") || null;
  if ((startsOn && !DATE.test(startsOn)) || (endsOn && !DATE.test(endsOn))) errors.endsOn = "Pick dates from the calendar.";
  else if (startsOn && endsOn && endsOn < startsOn) errors.endsOn = "The last day can't be before the first.";

  const maxRaw = text(formData, "maxUses").trim();
  const maxUses = maxRaw === "" ? null : Number(maxRaw);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) errors.maxUses = "Enter a whole number, or leave it blank.";
  const perClientRaw = text(formData, "maxUsesPerClient").trim();
  const maxUsesPerClient = perClientRaw === "" ? null : Number(perClientRaw);
  if (maxUsesPerClient !== null && (!Number.isInteger(maxUsesPerClient) || maxUsesPerClient < 1)) {
    errors.maxUsesPerClient = "Enter a whole number, or leave it blank.";
  }

  let sessionTypeIds: string[] = [];
  if (text(formData, "appliesTo") === "some") {
    const chosen = formData.getAll("sessionTypeIds").map(String).filter(isUuid);
    const owned = chosen.length
      ? await db
          .select({ id: sessionTypes.id })
          .from(sessionTypes)
          .where(and(eq(sessionTypes.photographerId, photographerId), inArray(sessionTypes.id, chosen)))
      : [];
    if (owned.length === 0) errors.sessions = "Pick at least one session.";
    sessionTypeIds = owned.map((s) => s.id);
  }

  if (Object.keys(errors).length > 0) return { ok: false as const, state: { errors } };
  return {
    ok: true as const,
    values: {
      code,
      kind,
      value,
      startsOn,
      endsOn,
      maxUses,
      maxUsesPerClient,
      sessionTypeIds,
      active: formData.get("active") === "on",
    },
  };
}

// Codes are unique per studio.
async function codeTaken(photographerId: string, code: string, exceptId?: string) {
  const [row] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(and(eq(coupons.photographerId, photographerId), eq(coupons.code, code)));
  return row !== undefined && row.id !== exceptId;
}

export async function addCoupon(_prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const photographer = await requirePhotographer();
  const result = await parseCoupon(formData, photographer.id);
  if (!result.ok) return result.state;
  if (await codeTaken(photographer.id, result.values.code)) return { errors: { code: "You already have a coupon with this code." } };
  await db.insert(coupons).values({ ...result.values, photographerId: photographer.id });
  revalidatePath("/dashboard/bookings", "layout");
  redirect("/dashboard/bookings/setup#coupons");
}

export async function updateCoupon(couponId: string, _prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(couponId)) return { message: "That coupon could not be found." };
  const result = await parseCoupon(formData, photographer.id);
  if (!result.ok) return result.state;
  if (await codeTaken(photographer.id, result.values.code, couponId)) {
    return { errors: { code: "You already have a coupon with this code." } };
  }
  const updated = await db
    .update(coupons)
    .set(result.values)
    .where(and(eq(coupons.id, couponId), eq(coupons.photographerId, photographer.id)))
    .returning({ id: coupons.id });
  if (updated.length === 0) return { message: "That coupon could not be found." };
  revalidatePath("/dashboard/bookings", "layout");
  redirect("/dashboard/bookings/setup#coupons");
}

// Bookings keep the code and discount they used, so deleting is safe.
export async function deleteCoupon(couponId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(couponId)) {
    await db.delete(coupons).where(and(eq(coupons.id, couponId), eq(coupons.photographerId, photographer.id)));
  }
  revalidatePath("/dashboard/bookings", "layout");
  redirect("/dashboard/bookings/setup#coupons");
}
