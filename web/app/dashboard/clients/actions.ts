"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { clients, sessionCredits } from "@/db/schema";
import { issueCredit } from "@/lib/credits";
import { requirePhotographer } from "@/lib/session";

// Server actions for the clients section. They run only on the server, and
// every one of them re-checks who is logged in and limits the change to that
// photographer's own clients.

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client's name.").max(200, "Keep the name under 200 characters."),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    .transform((value) => value || null),
  phone: optionalText(50, "Keep the phone number under 50 characters."),
  notes: optionalText(5000, "Keep notes under 5,000 characters."),
});

type ClientField = keyof z.input<typeof clientSchema>;

export type ClientFormState = {
  errors?: Partial<Record<ClientField, string>>;
  message?: string;
};

function parseClient(formData: FormData) {
  return clientSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
}

function toFormErrors(error: z.ZodError): ClientFormState {
  const errors: ClientFormState["errors"] = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as ClientField;
    errors[field] ??= issue.message;
  }
  return { errors };
}

const isUuid = (value: string) => z.uuid().safeParse(value).success;

export async function addClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const photographer = await requirePhotographer();
  const parsed = parseClient(formData);
  if (!parsed.success) return toFormErrors(parsed.error);

  await db.insert(clients).values({ ...parsed.data, photographerId: photographer.id });

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/clients");
}

export async function updateClient(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(clientId)) return { message: "That client could not be found." };

  const parsed = parseClient(formData);
  if (!parsed.success) return toFormErrors(parsed.error);

  const updated = await db
    .update(clients)
    .set(parsed.data)
    .where(and(eq(clients.id, clientId), eq(clients.photographerId, photographer.id)))
    .returning({ id: clients.id });
  if (updated.length === 0) return { message: "That client could not be found." };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/clients");
}

export async function deleteClient(clientId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(clientId)) {
    await db
      .delete(clients)
      .where(and(eq(clients.id, clientId), eq(clients.photographerId, photographer.id)));
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/clients");
}

// ---- Session credits ----

export type CreditFormState = { message?: string; saved?: boolean };

// Adds a session credit for a client by hand (they need an email: credits
// are matched by email when they book).
export async function addClientCredit(clientId: string, _prev: CreditFormState, formData: FormData): Promise<CreditFormState> {
  const photographer = await requirePhotographer();
  if (!isUuid(clientId)) return { message: "That client could not be found." };
  const [client] = await db
    .select({ name: clients.name, email: clients.email })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.photographerId, photographer.id)));
  if (!client) return { message: "That client could not be found." };
  if (!client.email) return { message: "Add the client's email first: credits are matched by email when they book." };

  const amount = String(formData.get("amount") ?? "").trim().replace(/[$,]/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return { message: "Enter an amount like 50 or 50.00." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || "Added by the studio";
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return { message: "Pick an expiry date, or leave it blank." };

  await issueCredit({
    photographerId: photographer.id,
    clientEmail: client.email,
    clientName: client.name,
    amountCents: Math.round(Number(amount) * 100),
    reason,
    // Blank uses the studio's usual credit length.
    ...(expiresOn ? { expiresOn } : {}),
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
  return { saved: true };
}

export async function removeClientCredit(clientId: string, creditId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (!isUuid(creditId)) return;
  await db
    .delete(sessionCredits)
    .where(and(eq(sessionCredits.id, creditId), eq(sessionCredits.photographerId, photographer.id)));
  revalidatePath(`/dashboard/clients/${clientId}`);
}
