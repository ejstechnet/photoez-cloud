import { and, asc, count, eq, gte, isNull } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { aiUsage, photographers, photos } from "@/db/schema";
import { tagPhoto } from "@/lib/ai/photo-tags";
import { localDateOf, zonedToUtc } from "@/lib/booking/time";
import { aiPhotoLimit, effectivePlan, hasFeature } from "@/lib/plans";
import { photoKey, readObject } from "@/lib/storage";

// Making a gallery searchable: a few photos per call (the dashboard keeps
// calling until none are left), each shrunk to 512px (plenty for "who, doing
// what, where" and about a third of the tokens of a full thumbnail), checked
// against the studio's plan and monthly allowance, and logged in ai_usage.

const PER_CALL = 5;
const EDGE = 512;

// Photos described this month (studio's calendar), and what the plan allows.
export async function photoAllowance(photographerId: string) {
  const [studio] = await db
    .select({ plan: photographers.plan, trialEndsAt: photographers.trialEndsAt, timeZone: photographers.timeZone })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  const monthStart = zonedToUtc(`${localDateOf(new Date(), studio.timeZone).slice(0, 7)}-01`, "00:00", studio.timeZone);
  const [{ used }] = await db
    .select({ used: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.photographerId, photographerId), eq(aiUsage.feature, "photo_tag"), gte(aiUsage.createdAt, monthStart)));
  const plan = effectivePlan(studio.plan, studio.trialEndsAt);
  const limit = aiPhotoLimit(studio.plan, studio.trialEndsAt);
  return { enabled: hasFeature(plan, "aiSearch"), used, limit, left: Math.max(0, limit - used) };
}

export async function untaggedCount(galleryId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), isNull(photos.aiTaggedAt)));
  return n;
}

export async function tagNextPhotos(
  galleryId: string,
  photographerId: string,
): Promise<{ tagged: number; failed: number; remaining: number } | { error: string }> {
  const allowance = await photoAllowance(photographerId);
  if (!allowance.enabled) return { error: "Gallery search isn't available on this plan." };
  if (allowance.left <= 0) return { error: "You've used this month's gallery search allowance." };

  const batch = await db
    .select({ id: photos.id, fileKey: photos.fileKey })
    .from(photos)
    .where(and(eq(photos.galleryId, galleryId), isNull(photos.aiTaggedAt)))
    .orderBy(asc(photos.kind), asc(photos.position))
    .limit(Math.min(PER_CALL, allowance.left));

  const results = await Promise.allSettled(
    batch.map(async (photo) => {
      const thumb = await readObject(photoKey(photo.fileKey, "thumb"));
      if (!thumb) throw new Error("Photo not found in storage.");
      const small = await sharp(thumb).resize({ width: EDGE, height: EDGE, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
      const result = await tagPhoto(small.toString("base64"));
      await db
        .update(photos)
        .set({ aiDescription: result.tags.description, aiTags: result.tags.tags, aiTaggedAt: new Date() })
        .where(eq(photos.id, photo.id));
      await db.insert(aiUsage).values({
        photographerId,
        feature: "photo_tag",
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  for (const f of failed) console.error("Photo tagging failed", (f as PromiseRejectedResult).reason);
  // Nothing worked at all: stop, rather than loop forever on a broken setup.
  if (batch.length > 0 && failed.length === batch.length) {
    return { error: "The photos couldn't be described right now. Please try again later." };
  }
  return { tagged: batch.length - failed.length, failed: failed.length, remaining: await untaggedCount(galleryId) };
}
