"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GROWTH_KINDS, GROWTH_STATUSES } from "@/lib/growth/constants";
import {
  addNote,
  changeStatus,
  createOpportunity,
  deleteOpportunity,
  setNextAction,
  setScoreOverride,
} from "@/lib/growth/opportunities";
import { requireOwner } from "@/lib/owner";

// Server actions for the owner-only Growth pages. Every one re-checks that
// PhotoEZ Cloud's owner is logged in (anyone else gets a 404).

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const postSchema = z.object({
  url: z.string().trim().min(1, "Paste the post's link.").max(2000, "That link is too long."),
  sourceId: z
    .string()
    .refine((v) => v === "" || z.uuid().safeParse(v).success, "Pick a source from the list.")
    .transform((v) => v || null),
  title: optionalText(300, "Keep the title under 300 characters."),
  excerpt: z
    .string()
    .trim()
    .min(1, "Paste the post's text, so it can be scored.")
    .max(10000, "Keep the text under 10,000 characters."),
  authorLabel: optionalText(120, "Keep the name under 120 characters."),
  publishedAt: z
    .string()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Enter a date.")
    .transform((v) => (v ? new Date(`${v}T12:00:00Z`) : null)),
  kind: z.enum(GROWTH_KINDS),
});

type PostField = keyof z.input<typeof postSchema>;

export type PostFormState = {
  errors?: Partial<Record<PostField, string>>;
  message?: string;
  // Set when the link was already saved, so the form can link to it.
  duplicateId?: string;
  // What was typed, so a pasted post isn't lost when something needs fixing
  // (React clears a form after each submit). `attempt` re-fills it.
  values?: Record<PostField, string>;
  attempt?: number;
};

export async function addPost(prev: PostFormState, formData: FormData): Promise<PostFormState> {
  await requireOwner();
  const values: Record<PostField, string> = {
    url: String(formData.get("url") ?? ""),
    sourceId: String(formData.get("sourceId") ?? ""),
    title: String(formData.get("title") ?? ""),
    excerpt: String(formData.get("excerpt") ?? ""),
    authorLabel: String(formData.get("authorLabel") ?? ""),
    publishedAt: String(formData.get("publishedAt") ?? ""),
    kind: String(formData.get("kind") ?? "sales_opportunity"),
  };
  const retry = (state: PostFormState): PostFormState => ({ ...state, values, attempt: (prev.attempt ?? 0) + 1 });

  const parsed = postSchema.safeParse(values);
  if (!parsed.success) {
    const errors: PostFormState["errors"] = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as PostField] ??= issue.message;
    return retry({ errors });
  }

  const result = await createOpportunity(parsed.data);
  if ("error" in result) return retry({ errors: { url: result.error } });
  if (result.duplicate) return retry({ message: "This post is already saved.", duplicateId: result.id });

  revalidatePath("/dashboard/growth");
  redirect(`/dashboard/growth/${result.id}`);
}

const idSchema = z.uuid();

export type ActionResult = { error?: string };

export async function movePost(id: string, to: string, evidence: string): Promise<ActionResult> {
  await requireOwner();
  const status = z.enum(GROWTH_STATUSES).safeParse(to);
  if (!idSchema.safeParse(id).success || !status.success) return { error: "Something's off with that change." };
  const problem = await changeStatus(id, status.data, evidence.slice(0, 2000));
  if (problem) return { error: problem };
  revalidatePath(`/dashboard/growth/${id}`);
  revalidatePath("/dashboard/growth");
  return {};
}

export async function notePost(id: string, body: string): Promise<ActionResult> {
  await requireOwner();
  const text = body.trim();
  if (!idSchema.safeParse(id).success) return { error: "Something's off with that note." };
  if (!text) return { error: "Write the note first." };
  if (text.length > 5000) return { error: "Keep notes under 5,000 characters." };
  await addNote(id, text);
  revalidatePath(`/dashboard/growth/${id}`);
  return {};
}

// score: a whole number 0–100, or "" to go back to the AI's score.
export async function overrideScore(id: string, score: string, reason: string): Promise<ActionResult> {
  await requireOwner();
  if (!idSchema.safeParse(id).success) return { error: "Something's off with that score." };
  let value: number | null = null;
  if (score.trim() !== "") {
    value = Number(score);
    if (!Number.isInteger(value) || value < 0 || value > 100) return { error: "Use a whole number from 0 to 100." };
  }
  await setScoreOverride(id, value, reason.slice(0, 500));
  revalidatePath(`/dashboard/growth/${id}`);
  revalidatePath("/dashboard/growth");
  return {};
}

// day: YYYY-MM-DD, or "" to clear the reminder.
export async function scheduleNextAction(id: string, day: string): Promise<ActionResult> {
  await requireOwner();
  if (!idSchema.safeParse(id).success) return { error: "Something's off with that date." };
  if (day && Number.isNaN(Date.parse(day))) return { error: "Enter a date." };
  await setNextAction(id, day ? new Date(`${day}T12:00:00Z`) : null);
  revalidatePath(`/dashboard/growth/${id}`);
  revalidatePath("/dashboard/growth");
  return {};
}

export async function removePost(id: string) {
  await requireOwner();
  if (idSchema.safeParse(id).success) await deleteOpportunity(id);
  revalidatePath("/dashboard/growth");
  redirect("/dashboard/growth");
}
