import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contractTemplates } from "@/db/schema";

// A studio's contract templates, for the session form's "Contract" choice.
export function contractChoices(photographerId: string) {
  return db
    .select({ id: contractTemplates.id, title: contractTemplates.title, isDefault: contractTemplates.isDefault })
    .from(contractTemplates)
    .where(eq(contractTemplates.photographerId, photographerId))
    .orderBy(asc(contractTemplates.createdAt));
}
