import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { ShareCard, shareSize } from "@/lib/share-card";

// The share picture for a studio's pages: its name and tagline.
export const alt = "Photography studio on PhotoEZ Cloud";
export const size = shareSize;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [studio] = await db
    .select({ name: photographers.name, businessName: photographers.businessName, tagline: photographers.studioTagline, area: photographers.serviceArea })
    .from(photographers)
    .where(eq(photographers.studioSlug, slug.toLowerCase()));
  const name = studio ? studio.businessName || studio.name : "Photography studio";
  const tagline = studio?.tagline?.slice(0, 110) ?? "See our work and book your session online.";
  return new ImageResponse(
    await ShareCard({ kicker: studio?.area ? `Photography · ${studio.area.trim().replace(/[.,;:!]+$/, "").slice(0, 40)}` : "Photography", title: name.slice(0, 60), line: tagline }),
    size,
  );
}
