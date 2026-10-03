import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { migrationKeys } from "@/db/schema";
import { formatDate } from "@/lib/booking/time";
import type { KeyRow } from "./migration-card";

// The studio's migration keys for Settings, newest first (revoked ones hidden).
export async function migrationKeyRows(photographerId: string, timeZone: string, now = new Date()): Promise<KeyRow[]> {
  const rows = await db
    .select()
    .from(migrationKeys)
    .where(and(eq(migrationKeys.photographerId, photographerId), isNull(migrationKeys.revokedAt)))
    .orderBy(desc(migrationKeys.createdAt))
    .limit(5);
  return rows.map((k) => ({
    id: k.id,
    created: formatDate(k.createdAt, timeZone, "short"),
    expires: formatDate(k.expiresAt, timeZone, "short"),
    lastUsed: k.lastUsedAt ? formatDate(k.lastUsedAt, timeZone, "short") : null,
    expired: k.expiresAt.getTime() < now.getTime(),
  }));
}
