"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { contractTemplates } from "@/db/schema";
import { DEFAULT_CONTRACT_HTML, DEFAULT_CONTRACT_TITLE } from "@/lib/contracts/default-contract";
import { cleanRichTextInput, richTextToPlain } from "@/lib/rich-text";
import { requirePhotographer } from "@/lib/session";

// Server actions for contract templates. Each re-checks who is logged in and
// only touches that photographer's own templates.

const isUuid = (value: string) => z.uuid().safeParse(value).success;

function refresh() {
  revalidatePath("/dashboard/bookings", "layout");
}

const contractSchema = z.object({
  title: z.string().trim().min(1, "Give the contract a title.").max(200, "Keep the title under 200 characters."),
  content: z
    .string()
    .max(200_000, "That contract is too long.")
    .transform(cleanRichTextInput)
    .refine((v) => v !== null, "Write the contract.")
    .refine((v) => v === null || richTextToPlain(v).length <= 60_000, "Keep the contract under 60,000 characters."),
  isDefault: z.boolean(),
});

type ContractField = keyof z.input<typeof contractSchema>;
export type ContractFormState = { errors?: Partial<Record<ContractField, string>>; message?: string };

function parseContract(formData: FormData) {
  return contractSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    content: String(formData.get("content") ?? ""),
    isDefault: formData.get("isDefault") === "on",
  });
}

function contractErrors(error: z.ZodError): ContractFormState {
  const errors: ContractFormState["errors"] = {};
  for (const issue of error.issues) errors[issue.path[0] as ContractField] ??= issue.message;
  return { errors };
}

// Only one template is the default; making one the default clears the others.
async function clearOtherDefaults(photographerId: string, keepId: string) {
  await db
    .update(contractTemplates)
    .set({ isDefault: false })
    .where(and(eq(contractTemplates.photographerId, photographerId), ne(contractTemplates.id, keepId)));
}

// A new template, pre-filled with the PhotoEZ default contract to edit.
export async function startFromDefault(): Promise<void> {
  const photographer = await requirePhotographer();
  const existing = await db
    .select({ id: contractTemplates.id })
    .from(contractTemplates)
    .where(eq(contractTemplates.photographerId, photographer.id))
    .limit(1);
  const [created] = await db
    .insert(contractTemplates)
    .values({
      photographerId: photographer.id,
      title: DEFAULT_CONTRACT_TITLE,
      content: DEFAULT_CONTRACT_HTML,
      // The first contract becomes the studio default.
      isDefault: existing.length === 0,
    })
    .returning({ id: contractTemplates.id });
  refresh();
  redirect(`/dashboard/bookings/contracts/${created.id}?added=1`);
}

export async function addContract(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const photographer = await requirePhotographer();
  const parsed = parseContract(formData);
  if (!parsed.success) return contractErrors(parsed.error);
  const [created] = await db
    .insert(contractTemplates)
    .values({ ...parsed.data, content: parsed.data.content!, photographerId: photographer.id })
    .returning({ id: contractTemplates.id });
  if (parsed.data.isDefault) await clearOtherDefaults(photographer.id, created.id);
  refresh();
  redirect("/dashboard/bookings/setup#contracts");
}

export async function updateContract(
  contractId: string,
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(contractId)) return { message: "That contract could not be found." };
  const parsed = parseContract(formData);
  if (!parsed.success) return contractErrors(parsed.error);
  const updated = await db
    .update(contractTemplates)
    .set({ ...parsed.data, content: parsed.data.content!, updatedAt: new Date() })
    .where(and(eq(contractTemplates.id, contractId), eq(contractTemplates.photographerId, photographer.id)))
    .returning({ id: contractTemplates.id });
  if (updated.length === 0) return { message: "That contract could not be found." };
  if (parsed.data.isDefault) await clearOtherDefaults(photographer.id, contractId);
  refresh();
  redirect("/dashboard/bookings/setup#contracts");
}

// Signed contracts keep their own copy, so deleting a template is safe.
export async function deleteContract(contractId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(contractId)) {
    await db
      .delete(contractTemplates)
      .where(and(eq(contractTemplates.id, contractId), eq(contractTemplates.photographerId, photographer.id)));
  }
  refresh();
  redirect("/dashboard/bookings/setup#contracts");
}
