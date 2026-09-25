import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { hasFeature } from "@/lib/plans";

// A photographer's plan and their studio-wide price per extra photo, for the
// dashboard's gallery forms and settings.
export async function studioPlan(photographerId: string) {
  const [studio] = await db
    .select({ plan: photographers.plan, extraPhotoPriceCents: photographers.extraPhotoPriceCents })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  return { ...studio, upsells: hasFeature(studio.plan, "galleryUpsells") };
}
