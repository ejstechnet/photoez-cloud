import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { growthAudit, growthJobRuns, growthKeywords, growthSources } from "@/db/schema";
import { DEFAULT_DISCLOSURE, GROWTH_KEYWORD_GROUPS, GROWTH_PLATFORMS } from "./constants";

// The Growth Sources page's data: where posts come from (feeds read
// automatically, searches Elle runs herself, the places she posts) with
// each community's rules, and the search phrases. Callers check
// requireOwner() first. Tested in sources.test.ts.

const httpsUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(2000, message)
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), message);

export const sourceSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(120, "Keep the name under 120 characters."),
  platform: z.enum(GROWTH_PLATFORMS),
  kind: z.enum(["manual", "rss"]),
  // rss: the feed to read. manual: an optional search to open in one click.
  feedUrl: httpsUrl("Paste the feed's https address."),
  searchUrl: httpsUrl("Paste the search's https address."),
  filter: z.enum(["none", "keywords"]),
  enabled: z.boolean(),
  linksAllowed: z.boolean(),
  selfPromoAllowed: z.boolean(),
  disclosure: z.string().trim().max(200, "Keep it under 200 characters.").transform((v) => v || DEFAULT_DISCLOSURE),
  rulesNote: z
    .string()
    .trim()
    .max(1000, "Keep the note under 1,000 characters.")
    .transform((v) => v || null),
});
export type SourceInput = z.input<typeof sourceSchema>;

// The form's fields as the schema wants them (checkboxes are "on" or missing).
export function sourceFromForm(form: FormData): SourceInput {
  const text = (key: string) => String(form.get(key) ?? "");
  return {
    name: text("name"),
    platform: text("platform") as SourceInput["platform"],
    kind: text("kind") as SourceInput["kind"],
    feedUrl: text("feedUrl"),
    searchUrl: text("searchUrl"),
    filter: (text("filter") || "none") as SourceInput["filter"],
    enabled: form.get("enabled") === "on",
    linksAllowed: form.get("linksAllowed") === "on",
    selfPromoAllowed: form.get("selfPromoAllowed") === "on",
    disclosure: text("disclosure"),
    rulesNote: text("rulesNote"),
  };
}

function toRow(data: z.output<typeof sourceSchema>) {
  const config: Record<string, string> =
    data.kind === "rss" ? { feedUrl: data.feedUrl, filter: data.filter } : data.searchUrl ? { searchUrl: data.searchUrl } : {};
  return {
    name: data.name,
    platform: data.platform,
    kind: data.kind,
    config,
    enabled: data.enabled,
    linksAllowed: data.linksAllowed,
    selfPromoAllowed: data.selfPromoAllowed,
    disclosure: data.disclosure,
    rulesNote: data.rulesNote,
    rulesCheckedAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date(),
  };
}

export type SourceProblem = Partial<Record<keyof SourceInput, string>>;

// Adds (no id) or updates a source. Returns problems to show, or the id.
export async function saveSource(input: SourceInput, id?: string): Promise<{ id: string } | { problems: SourceProblem }> {
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    const problems: SourceProblem = {};
    for (const issue of parsed.error.issues) problems[issue.path[0] as keyof SourceInput] ??= issue.message;
    return { problems };
  }
  if (parsed.data.kind === "rss" && !parsed.data.feedUrl) return { problems: { feedUrl: "Paste the feed's https address." } };

  const row = toRow(parsed.data);
  const [sameName] = await db.select({ id: growthSources.id }).from(growthSources).where(eq(growthSources.name, row.name));
  if (sameName && sameName.id !== id) return { problems: { name: "Another source already has that name." } };
  try {
    if (id) {
      // A feed that's changed is read again on the next run.
      const [before] = await db.select({ config: growthSources.config }).from(growthSources).where(eq(growthSources.id, id));
      const reread = before?.config.feedUrl !== row.config.feedUrl ? { lastRunAt: null } : {};
      await db.update(growthSources).set({ ...row, ...reread }).where(eq(growthSources.id, id));
      await db.insert(growthAudit).values({ action: "setting_changed", entityId: id, details: { source: row.name } });
      return { id };
    }
    const [made] = await db.insert(growthSources).values(row).returning({ id: growthSources.id });
    await db.insert(growthAudit).values({ action: "setting_changed", entityId: made.id, details: { source: row.name, added: true } });
    return { id: made.id };
  } catch (error) {
    // Saved under the same name in another tab a moment ago.
    if ((error as { cause?: { code?: string } })?.cause?.code === "23505") return { problems: { name: "Another source already has that name." } };
    throw error;
  }
}

// Deletes a source; posts found through it stay, with no source.
export async function deleteSource(id: string) {
  const [gone] = await db.delete(growthSources).where(eq(growthSources.id, id)).returning({ name: growthSources.name });
  if (gone) await db.insert(growthAudit).values({ action: "setting_changed", entityId: id, details: { source: gone.name, deleted: true } });
}

// Every source with its latest automatic read, for the Sources page.
export async function sourcesWithLastRun() {
  const [sources, runs] = await Promise.all([
    db.select().from(growthSources).orderBy(asc(growthSources.kind), asc(growthSources.name)),
    db.select().from(growthJobRuns).orderBy(desc(growthJobRuns.startedAt)).limit(200),
  ]);
  return sources.map((s) => ({ ...s, lastRun: runs.find((r) => r.sourceId === s.id) ?? null }));
}

// Searches Elle runs herself, for one-click buttons on the Growth page.
export async function savedSearches() {
  const rows = await db.select().from(growthSources).where(eq(growthSources.enabled, true)).orderBy(asc(growthSources.name));
  return rows.filter((s) => s.config.searchUrl && /^https:\/\//i.test(s.config.searchUrl)).map((s) => ({ id: s.id, name: s.name, url: s.config.searchUrl }));
}

// ---- Search phrases ----

export const keywordSchema = z.object({
  group: z.enum(GROWTH_KEYWORD_GROUPS),
  phrase: z.string().trim().min(2, "Type a phrase.").max(120, "Keep the phrase under 120 characters."),
});

export async function listKeywords() {
  return db.select().from(growthKeywords).orderBy(asc(growthKeywords.group), asc(growthKeywords.phrase));
}

export async function addKeyword(group: string, phrase: string): Promise<string | null> {
  const parsed = keywordSchema.safeParse({ group, phrase });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Check the phrase.";
  const [made] = await db.insert(growthKeywords).values(parsed.data).onConflictDoNothing({ target: growthKeywords.phrase }).returning({ id: growthKeywords.id });
  return made ? null : "That phrase is already there.";
}

export async function setKeywordEnabled(id: string, enabled: boolean) {
  await db.update(growthKeywords).set({ enabled }).where(eq(growthKeywords.id, id));
}

export async function deleteKeyword(id: string) {
  await db.delete(growthKeywords).where(eq(growthKeywords.id, id));
}
