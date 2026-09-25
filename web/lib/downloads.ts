import { count, inArray, max, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { galleryDownloads } from "@/db/schema";

export type DownloadSummary = {
  firstAt: Date;
  lastAt: Date;
  zips: number;
  photos: number;
};

// Whether (and when) clients downloaded from each gallery's delivery page.
export async function downloadSummaries(galleryIds: string[]): Promise<Map<string, DownloadSummary>> {
  if (galleryIds.length === 0) return new Map();
  const rows = await db
    .select({
      galleryId: galleryDownloads.galleryId,
      firstAt: min(galleryDownloads.createdAt),
      lastAt: max(galleryDownloads.createdAt),
      zips: count(sql`case when ${galleryDownloads.kind} = 'all' then 1 end`),
      photos: count(sql`case when ${galleryDownloads.kind} = 'photo' then 1 end`),
    })
    .from(galleryDownloads)
    .where(inArray(galleryDownloads.galleryId, galleryIds))
    .groupBy(galleryDownloads.galleryId);
  return new Map(
    rows.map((r) => [r.galleryId, { firstAt: r.firstAt!, lastAt: r.lastAt!, zips: r.zips, photos: r.photos }]),
  );
}

// "Downloaded all photos (ZIP) twice and 3 single photos, last on Sep 30."
export function describeDownloads(summary: DownloadSummary | undefined): string {
  if (!summary) return "Your client hasn't downloaded anything yet.";
  const parts = [
    summary.zips > 0 ? `all photos as a ZIP${summary.zips > 1 ? ` (${summary.zips} times)` : ""}` : null,
    summary.photos > 0 ? `${summary.photos} single photo${summary.photos === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `Your client downloaded ${parts.join(" and ")}. First on ${day(summary.firstAt)}${
    summary.lastAt.getTime() - summary.firstAt.getTime() > 60_000 ? `, most recently ${day(summary.lastAt)}` : ""
  }.`;
}
