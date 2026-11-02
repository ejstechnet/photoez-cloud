"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { studioEmailTemplates } from "@/db/schema";
import { afterResponse } from "@/lib/email/send";
import { requireOwner } from "@/lib/owner";
import { checkDraft, type Draft, type DraftErrors } from "@/lib/studio-emails";
import { createSend, processSend, sendTest } from "@/lib/studio-emails-server";

// The owner's Email studios page (Settings > Email studios). Every action
// checks for the owner first.

export type ActionResult = { ok?: string; error?: string; errors?: DraftErrors };

const PAGE = "/dashboard/studio-emails";

const tidy = (d: Draft): Draft => ({
  subject: String(d.subject ?? "").slice(0, 300),
  heading: String(d.heading ?? "").slice(0, 300),
  body: String(d.body ?? "").slice(0, 12000),
  buttonLabel: String(d.buttonLabel ?? "").slice(0, 100),
  buttonUrl: String(d.buttonUrl ?? "").slice(0, 1000),
});

export async function saveTemplate(id: string | null, name: string, input: Draft): Promise<ActionResult & { id?: string }> {
  await requireOwner();
  const draft = tidy(input);
  const label = name.trim().slice(0, 80);
  if (!label) return { error: "Give the template a name." };
  if (!draft.body.trim()) return { errors: { body: "Write the message." } };
  if (id) {
    await db
      .update(studioEmailTemplates)
      .set({ name: label, ...draft, updatedAt: new Date() })
      .where(eq(studioEmailTemplates.id, id));
    revalidatePath(PAGE);
    return { ok: `Saved "${label}".`, id };
  }
  const [row] = await db.insert(studioEmailTemplates).values({ name: label, ...draft }).returning({ id: studioEmailTemplates.id });
  revalidatePath(PAGE);
  return { ok: `Saved "${label}" as a new template.`, id: row.id };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  await requireOwner();
  await db.delete(studioEmailTemplates).where(eq(studioEmailTemplates.id, id));
  revalidatePath(PAGE);
  return { ok: "Template deleted." };
}

export async function sendTestEmail(input: Draft, sampleStudioId: string | null): Promise<ActionResult> {
  const owner = await requireOwner();
  const draft = tidy(input);
  const errors = checkDraft(draft);
  if (Object.keys(errors).length) return { errors };
  const sent = await sendTest(draft, sampleStudioId);
  return sent
    ? { ok: `Test sent to ${owner.email}. Check your inbox (and spam).` }
    : { error: "The test didn't go through. The Email log in Settings shows why." };
}

export async function sendToStudios(input: Draft, studioIds: string[], templateName: string | null): Promise<ActionResult> {
  await requireOwner();
  const draft = tidy(input);
  const errors = checkDraft(draft);
  if (Object.keys(errors).length) return { errors };
  if (!Array.isArray(studioIds) || studioIds.length === 0) return { error: "Choose at least one studio." };
  const created = await createSend(draft, studioIds.map(String), templateName ? String(templateName).slice(0, 80) : null);
  if (!created) return { error: "None of those studios can get this email (they've unsubscribed)." };
  // Goes out in the background, a few at a time; progress shows under Sent.
  afterResponse(() => processSend(created.sendId));
  revalidatePath(PAGE);
  return { ok: `Sending to ${created.count === 1 ? "1 studio" : `${created.count} studios`}. Progress shows under Sent below.` };
}

export async function resumeSend(sendId: string) {
  await requireOwner();
  afterResponse(() => processSend(sendId));
  revalidatePath(PAGE);
}
