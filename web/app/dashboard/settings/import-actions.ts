"use server";

import { revalidatePath } from "next/cache";
import { clearImport, previewSource, runStep, startImport, type ImportJob, type SourcePreview } from "@/lib/migration/importer";
import type { ImportChoice } from "@/lib/migration/format";
import { requirePhotographer } from "@/lib/session";

// Settings > Move from PhotoEZ for WordPress. The page calls stepImport over
// and over while the import runs, showing progress after each step.

export type ImportView = Pick<ImportJob, "studioName" | "phase" | "totals" | "done" | "errors"> & { finished: boolean };

function view(job: ImportJob): ImportView {
  return { studioName: job.studioName, phase: job.phase, totals: job.totals, done: job.done, errors: job.errors, finished: job.phase === "done" };
}

// "Connect": read what the WordPress site has, without importing anything.
export async function connectSource(input: { address: string; key: string }): Promise<{ preview?: SourcePreview; error?: string }> {
  await requirePhotographer();
  const result = await previewSource(input.address.slice(0, 300), input.key.slice(0, 120));
  return "error" in result ? { error: result.error } : { preview: result };
}

export async function beginImport(input: {
  address: string;
  key: string;
  hideSessions: boolean;
  include: ImportChoice;
  galleries: { id: string; photos: number }[];
}): Promise<{ job?: ImportView; error?: string }> {
  const user = await requirePhotographer();
  const include: ImportChoice = {
    clients: Boolean(input.include.clients),
    sessions: Boolean(input.include.sessions),
    contracts: Boolean(input.include.contracts),
    galleryIds: input.include.galleryIds.map(String).slice(0, 5000),
    clientIds: input.include.clientIds.map(String).slice(0, 5000),
  };
  const result = await startImport(
    user.id,
    input.address.slice(0, 300),
    input.key.slice(0, 120),
    input.hideSessions,
    include,
    input.galleries.slice(0, 5000).map((g) => ({ id: String(g.id), photos: Math.max(0, Number(g.photos) || 0) })),
  );
  if ("error" in result) return { error: result.error };
  return { job: view(result) };
}

export async function stepImport(): Promise<{ job?: ImportView; error?: string }> {
  const user = await requirePhotographer();
  const result = await runStep(user.id);
  if (!("job" in result)) return { error: result.error };
  if (result.job.phase === "done") revalidatePath("/dashboard", "layout");
  return { job: view(result.job), error: result.error };
}

export async function resetImport(): Promise<void> {
  const user = await requirePhotographer();
  await clearImport(user.id);
  revalidatePath("/dashboard/settings");
}
