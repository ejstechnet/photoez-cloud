import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionTypes } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { addField } from "../../field-actions";
import { FieldForm } from "../../field-form";

export default async function NewFieldPage() {
  const user = await requirePhotographer();
  const sessions = await db
    .select({ id: sessionTypes.id, name: sessionTypes.name })
    .from(sessionTypes)
    .where(eq(sessionTypes.photographerId, user.id))
    .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt));

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup#form" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to booking form
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Add a question</h1>
      <p className="mt-2 text-muted">Asked on your booking form, after the client&apos;s name and email.</p>
      <div className="card mt-8 p-6 sm:p-8">
        <FieldForm action={addField} sessions={sessions} submitLabel="Add question" />
      </div>
    </div>
  );
}
