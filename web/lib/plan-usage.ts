import { and, count, eq, notInArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { galleries, photographers, photos } from "@/db/schema";
import { PLAN_LABELS, PLAN_LIMITS, STORAGE_BLOCK_BYTES, STORAGE_BLOCK_PRICES, canBuyStorage, effectivePlan, formatStorage, storageLimit } from "@/lib/plans";

// What a studio is using against its plan's limits (lib/plans.ts). Limits
// only stop new galleries and new uploads; nothing already there is touched.

// Galleries stop counting once they're completed or expired.
const INACTIVE = ["completed", "expired"] as const;

export async function planUsage(photographerId: string) {
  const [[studio], [storage], [active]] = await Promise.all([
    db
      .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt, extraBlocks: photographers.extraStorageBlocks })
      .from(photographers)
      .where(eq(photographers.id, photographerId)),
    db
      .select({ bytes: sum(photos.sizeBytes) })
      .from(photos)
      .innerJoin(galleries, eq(galleries.id, photos.galleryId))
      .where(eq(galleries.photographerId, photographerId)),
    db
      .select({ n: count() })
      .from(galleries)
      .where(and(eq(galleries.photographerId, photographerId), notInArray(galleries.status, [...INACTIVE]))),
  ]);
  const plan = effectivePlan(studio.plan, studio.trialEndsAt);
  return {
    plan,
    // The plan's storage plus any extra storage bought (Pro and Studio).
    limits: { ...PLAN_LIMITS[plan], storageBytes: storageLimit(plan, studio.extraBlocks) },
    extraBlocks: canBuyStorage(plan) ? studio.extraBlocks : 0,
    storageBytes: Number(storage.bytes ?? 0),
    activeGalleries: active.n,
  };
}

export const isActiveStatus = (status: string) => !(INACTIVE as readonly string[]).includes(status);

// An error message when one more active gallery would pass the plan's limit.
export async function galleryLimitError(photographerId: string): Promise<string | null> {
  const usage = await planUsage(photographerId);
  const max = usage.limits.activeGalleries;
  if (max === null || usage.activeGalleries < max) return null;
  return `The ${PLAN_LABELS[usage.plan]} plan includes ${max} active galleries. Mark a finished gallery Completed, or upgrade in Billing for unlimited galleries.`;
}

// An error message when these uploads would pass the plan's storage.
export async function storageLimitError(photographerId: string, addingBytes: number): Promise<string | null> {
  const usage = await planUsage(photographerId);
  if (usage.storageBytes + addingBytes <= usage.limits.storageBytes) return null;
  const left = Math.max(0, usage.limits.storageBytes - usage.storageBytes);
  const more = canBuyStorage(usage.plan)
    ? `Add more in Billing (${formatStorage(STORAGE_BLOCK_BYTES)} for $${STORAGE_BLOCK_PRICES.month / 100} a month).`
    : "Upgrade in Billing for more room.";
  return `Your studio has ${formatStorage(usage.limits.storageBytes)} of photo storage, and ${formatStorage(left)} is left. ${more}`;
}
