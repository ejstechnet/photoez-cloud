import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos } from "@/db/schema";

// Searching a gallery's photos by what the AI saw in them. A search matches
// whole words, kept together as a phrase, within one tag or the description:
// "man" never finds "woman", and "white background" needs those words side by
// side (not "white bodysuit" plus "beige background"). Postgres's word search
// handles plurals and word forms ("dancing" finds "dance"). Measured by the
// photo-tagging eval (evals/photo-tags).

// What someone typed, tidied (and kept short).
export function cleanQuery(input: string) {
  return input.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export async function searchGalleryPhotos(galleryId: string, input: string, kinds: ("proof" | "final")[] = ["proof", "final"]) {
  const q = cleanQuery(input);
  if (!q) return [];
  const phrase = sql`phraseto_tsquery('english', ${q})`;
  // The whole phrase as typed, at word boundaries: catches what the word search
  // drops, like text made only of common words ("I did it").
  const exact = `\\m${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\M`;
  const rows = await db
    .select({ id: photos.id })
    .from(photos)
    .where(
      and(
        eq(photos.galleryId, galleryId),
        inArray(photos.kind, kinds),
        isNotNull(photos.aiTaggedAt),
        sql`(
          to_tsvector('english', coalesce(${photos.aiDescription}, '')) @@ ${phrase}
          or exists (select 1 from jsonb_array_elements_text(${photos.aiTags}) as tag(t) where to_tsvector('english', tag.t) @@ ${phrase})
          or coalesce(${photos.aiDescription}, '') ~* ${exact}
          or exists (select 1 from jsonb_array_elements_text(${photos.aiTags}) as tag(t) where tag.t ~* ${exact})
        )`,
      ),
    );
  return rows.map((r) => r.id);
}
