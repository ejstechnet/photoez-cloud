import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { effectivePlan, hasFeature } from "@/lib/plans";

// A photographer's plan and their studio-wide price per extra photo, for the
// dashboard's gallery forms and settings.
export async function studioPlan(photographerId: string) {
  const [studio] = await db
    .select({
      plan: photographers.plan,
      trialEndsAt: photographers.trialEndsAt,
      extraPhotoPriceCents: photographers.extraPhotoPriceCents,
    })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  // The plan in effect: Pro during the free trial.
  const plan = effectivePlan(studio.plan, studio.trialEndsAt);
  return { ...studio, plan, upsells: hasFeature(plan, "galleryUpsells") };
}
