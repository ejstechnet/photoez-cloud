import { eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { photographers, photos } from "@/db/schema";
import { signedViewUrl } from "@/lib/storage";
import type { WatermarkSettings } from "@/lib/proof-maker";

// A proof is stale if it was never made, or made before the watermark last changed.
export function staleProof(watermarkUpdatedAt: Date | null) {
  return watermarkUpdatedAt
    ? or(isNull(photos.proofMadeAt), lt(photos.proofMadeAt, watermarkUpdatedAt))
    : isNull(photos.proofMadeAt);
}

// The photographer's watermark, ready for the browser to stamp onto proofs.
export async function getWatermarkSettings(
  photographerId: string,
): Promise<(WatermarkSettings & { updatedAt: Date | null }) | null> {
  const [row] = await db
    .select({
      key: photographers.watermarkKey,
      opacity: photographers.watermarkOpacity,
      position: photographers.watermarkPosition,
      updatedAt: photographers.watermarkUpdatedAt,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  if (!row?.key) return null;
  return { url: await signedViewUrl(row.key), opacity: row.opacity, position: row.position, updatedAt: row.updatedAt };
}
