import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, contractTemplates } from "@/db/schema";

// The studio's clients and contracts, for the editor's dropdowns.
export async function editorChoices(photographerId: string) {
  const [clientRows, templates] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, email: clients.email, phone: clients.phone })
      .from(clients)
      .where(eq(clients.photographerId, photographerId))
      .orderBy(asc(clients.name))
      .limit(1000),
    db
      .select({ id: contractTemplates.id, title: contractTemplates.title, isDefault: contractTemplates.isDefault })
      .from(contractTemplates)
      .where(eq(contractTemplates.photographerId, photographerId))
      .orderBy(desc(contractTemplates.isDefault), asc(contractTemplates.title)),
  ]);
  return { clients: clientRows, templates };
}
