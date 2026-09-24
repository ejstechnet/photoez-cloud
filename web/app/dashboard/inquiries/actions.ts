"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, inquiries } from "@/db/schema";
import { triageInquiry } from "@/lib/ai/triage";
import { requirePhotographer } from "@/lib/session";

// Inquiry actions. Every one re-checks who is logged in and only touches that
// photographer's inquiries.

const isUuid = (value: string) => z.uuid().safeParse(value).success;

async function findOwnedInquiry(inquiryId: string, photographerId: string) {
  if (!isUuid(inquiryId)) return null;
  const [inquiry] = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.id, inquiryId), eq(inquiries.photographerId, photographerId)));
  return inquiry ?? null;
}

// Run the AI triage and store the result (or the error, so the inquiry is
// never lost just because the AI step failed).
async function runTriage(
  inquiry: { id: string; message: string; fromName: string | null; fromEmail: string | null },
  photographer: { name: string; businessName?: string | null },
) {
  try {
    const run = await triageInquiry({
      message: inquiry.message,
      fromName: inquiry.fromName,
      fromEmail: inquiry.fromEmail,
      photographerName: photographer.name,
      studioName: photographer.businessName ?? null,
      today: new Date(),
    });
    await db
      .update(inquiries)
      .set({
        triage: run.result,
        triageError: null,
        model: run.model,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        triagedAt: new Date(),
      })
      .where(eq(inquiries.id, inquiry.id));
  } catch (error) {
    console.error("Inquiry triage failed", error);
    await db
      .update(inquiries)
      .set({
        triageError:
          error instanceof Error && error.message.startsWith("The AI")
            ? error.message
            : "The AI couldn't read this inquiry right now. Try again in a minute.",
      })
      .where(eq(inquiries.id, inquiry.id));
  }
}

const newInquirySchema = z.object({
  message: z
    .string()
    .trim()
    .min(20, "Paste the full inquiry (at least a sentence or two).")
    .max(20_000, "That's longer than an inquiry should be. Paste just the message."),
  fromName: z.string().trim().max(200).transform((value) => value || null),
  fromEmail: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    .transform((value) => value || null),
});

export type NewInquiryState = {
  errors?: Partial<Record<keyof z.input<typeof newInquirySchema>, string>>;
};

export async function createInquiry(_prev: NewInquiryState, formData: FormData): Promise<NewInquiryState> {
  const photographer = await requirePhotographer();
  const parsed = newInquirySchema.safeParse({
    message: String(formData.get("message") ?? ""),
    fromName: String(formData.get("fromName") ?? ""),
    fromEmail: String(formData.get("fromEmail") ?? ""),
  });
  if (!parsed.success) {
    const errors: NewInquiryState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof z.input<typeof newInquirySchema>;
      errors[field] ??= issue.message;
    }
    return { errors };
  }

  const [inquiry] = await db
    .insert(inquiries)
    .values({ ...parsed.data, photographerId: photographer.id })
    .returning();
  await runTriage(inquiry, photographer);

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/inquiries/${inquiry.id}`);
}

export async function retriageInquiry(inquiryId: string): Promise<void> {
  const photographer = await requirePhotographer();
  const inquiry = await findOwnedInquiry(inquiryId, photographer.id);
  if (inquiry) await runTriage(inquiry, photographer);
  revalidatePath(`/dashboard/inquiries/${inquiryId}`);
}

export async function setInquiryStatus(inquiryId: string, status: "new" | "replied" | "archived"): Promise<void> {
  const photographer = await requirePhotographer();
  const inquiry = await findOwnedInquiry(inquiryId, photographer.id);
  if (inquiry && inquiry.status !== "converted" && ["new", "replied", "archived"].includes(status)) {
    await db.update(inquiries).set({ status }).where(eq(inquiries.id, inquiry.id));
  }
  revalidatePath("/dashboard", "layout");
}

// Turn the inquiry into a client, pre-filled from what the AI extracted.
export async function convertToClient(inquiryId: string): Promise<void> {
  const photographer = await requirePhotographer();
  const inquiry = await findOwnedInquiry(inquiryId, photographer.id);
  if (!inquiry) redirect("/dashboard/inquiries");
  if (inquiry.clientId) redirect(`/dashboard/clients/${inquiry.clientId}`);

  const t = inquiry.triage;
  const notes = t
    ? [
        t.summary,
        t.dateText && `Date: ${t.dateText}`,
        t.location && `Location: ${t.location}`,
        t.budgetText && `Budget: ${t.budgetText}`,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  const [client] = await db
    .insert(clients)
    .values({
      photographerId: photographer.id,
      name: t?.clientName ?? inquiry.fromName ?? "New client",
      email: t?.email ?? inquiry.fromEmail,
      phone: t?.phone ?? null,
      notes,
    })
    .returning({ id: clients.id });

  await db.update(inquiries).set({ clientId: client.id, status: "converted" }).where(eq(inquiries.id, inquiry.id));
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/clients/${client.id}`);
}
