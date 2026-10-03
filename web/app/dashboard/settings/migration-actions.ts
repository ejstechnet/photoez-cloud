"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { migrationKeys } from "@/db/schema";
import { KEY_DAYS, hashMigrationKey, newMigrationKey } from "@/lib/migration/format";
import { requirePhotographer } from "@/lib/session";

// Settings > Move to WordPress: make or revoke a migration key. The key is
// returned once and never stored, only its hash.

const MAX_ACTIVE = 3;

export async function createMigrationKey(): Promise<{ key?: string; message?: string }> {
  const user = await requirePhotographer();
  const active = await db
    .select({ id: migrationKeys.id })
    .from(migrationKeys)
    .where(and(eq(migrationKeys.photographerId, user.id), isNull(migrationKeys.revokedAt)));
  if (active.length >= MAX_ACTIVE) return { message: `Revoke an older key first (up to ${MAX_ACTIVE} at a time).` };
  const key = newMigrationKey();
  await db.insert(migrationKeys).values({
    photographerId: user.id,
    keyHash: hashMigrationKey(key),
    expiresAt: new Date(Date.now() + KEY_DAYS * 24 * 60 * 60 * 1000),
  });
  revalidatePath("/dashboard/settings");
  return { key };
}

export async function revokeMigrationKey(id: string): Promise<void> {
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) return;
  await db
    .update(migrationKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(migrationKeys.id, id), eq(migrationKeys.photographerId, user.id)));
  revalidatePath("/dashboard/settings");
}
