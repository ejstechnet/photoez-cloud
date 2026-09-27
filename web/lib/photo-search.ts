import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";

// Searching a gallery's photos by what the AI saw in them. Postgres's word
// search handles plurals and word forms ("dancing" finds "dance"), and a
// plain text match catches anything it misses.

// What someone typed, tidied (and kept short).
export function cleanQuery(input: string) {
  return input.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function searchGalleryPhotos(galleryId: string, input: string, kinds: ("proof" | "final")[] = ["proof", "final"]) {
  const q = cleanQuery(input);
  if (!q) return [];
  const text = sql`coalesce(${photos.aiDescription}, '') || ' ' || coalesce((select string_agg(t, ' ') from jsonb_array_elements_text(${photos.aiTags}) as t), '')`;
  const rows = await db
    .select({ id: photos.id })
    .from(photos)
    .where(
      and(
        eq(photos.galleryId, galleryId),
        inArray(photos.kind, kinds),
        isNotNull(photos.aiTaggedAt),
        sql`(to_tsvector('english', ${text}) @@ websearch_to_tsquery('english', ${q}) or ${text} ilike ${`%${q}%`})`,
      ),
    );
  return rows.map((r) => r.id);
}
