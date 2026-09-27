import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/db";
import { photographers } from "@/db/schema";
import { readObject } from "@/lib/storage";

// The studio's logo for the top of its emails: a permanent public address
// (photo storage links expire after hours; emails get opened days later).
// It always serves the current logo, so a new logo shows in old emails too.
// Served as a small PNG, which every email program can show.
export async function GET(_request: Request, { params }: RouteContext<"/email-logo/[studio]">) {
  const { studio: photographerId } = await params;
  if (!z.uuid().safeParse(photographerId).success) return new Response("Not found", { status: 404 });

  const [studio] = await db
    .select({ key: photographers.studioLogoKey })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  const original = studio?.key ? await readObject(studio.key) : null;
  if (!original) return new Response("Not found", { status: 404 });

  // Twice the 56px it's shown at, for sharp screens.
  const png = await sharp(original)
    .resize({ height: 112, width: 480, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // A day, so a replaced logo shows up in emails soon after.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
