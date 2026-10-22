"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { growthSources } from "@/db/schema";
import { discoverSource } from "@/lib/growth/discover";
import { addKeyword, deleteKeyword, deleteSource, saveSource, setKeywordEnabled, sourceFromForm, type SourceInput, type SourceProblem } from "@/lib/growth/sources";
import { requireOwner } from "@/lib/owner";

// Server actions for Growth → Sources & phrases (owner only).

const isId = (v: string) => z.uuid().safeParse(v).success;
const refresh = () => {
  revalidatePath("/dashboard/growth/sources");
  revalidatePath("/dashboard/growth");
};

export type SourceFormState = {
  problems?: SourceProblem;
  saved?: boolean;
  // What was typed, so nothing is lost when something needs fixing.
  values?: SourceInput;
  attempt?: number;
};

// Adds a source (id null) or saves changes to one.
export async function saveSourceAction(id: string | null, prev: SourceFormState, formData: FormData): Promise<SourceFormState> {
  await requireOwner();
  if (id && !isId(id)) return { problems: { name: "Something's off with that source." } };
  const values = sourceFromForm(formData);
  const result = await saveSource(values, id ?? undefined);
  if ("problems" in result) return { problems: result.problems, values, attempt: (prev.attempt ?? 0) + 1 };
  refresh();
  return { saved: true, attempt: (prev.attempt ?? 0) + 1 };
}

export async function removeSource(id: string) {
  await requireOwner();
  if (isId(id)) await deleteSource(id);
  refresh();
}

// "Check now": reads a feed right away instead of waiting for the next run.
export async function checkFeedNow(id: string): Promise<{ message: string }> {
  await requireOwner();
  if (!isId(id)) return { message: "Something's off with that source." };
  const [source] = await db.select().from(growthSources).where(eq(growthSources.id, id));
  if (!source || source.kind !== "rss") return { message: "Only feeds can be checked." };
  const out = await discoverSource(source);
  refresh();
  if ("error" in out && out.error) return { message: `Couldn't read it: ${out.error}` };
  return {
    message: `Read ${out.found} item${out.found === 1 ? "" : "s"}: ${out.saved} new, ${out.kept} kept by the AI.${out.saved > 0 && out.kept === 0 ? " (The rest are under Filtered out by AI, or waiting to be scored.)" : ""}`,
  };
}

export async function addPhrase(group: string, phrase: string): Promise<{ error?: string }> {
  await requireOwner();
  const problem = await addKeyword(group, phrase);
  refresh();
  return problem ? { error: problem } : {};
}

export async function togglePhrase(id: string, enabled: boolean) {
  await requireOwner();
  if (isId(id)) await setKeywordEnabled(id, enabled);
  refresh();
}

export async function removePhrase(id: string) {
  await requireOwner();
  if (isId(id)) await deleteKeyword(id);
  refresh();
}
