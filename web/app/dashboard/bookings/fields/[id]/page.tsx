import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookingFields, sessionTypes } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { ConfirmButton } from "../../confirm-button";
import { deleteField, updateField } from "../../field-actions";
import { FieldForm } from "../../field-form";

export default async function EditFieldPage({ params }: PageProps<"/dashboard/bookings/fields/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [[field], sessions] = await Promise.all([
    db
      .select()
      .from(bookingFields)
      .where(and(eq(bookingFields.id, id), eq(bookingFields.photographerId, user.id))),
    db
      .select({ id: sessionTypes.id, name: sessionTypes.name })
      .from(sessionTypes)
      .where(eq(sessionTypes.photographerId, user.id))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.createdAt)),
  ]);
  if (!field) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup#form" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Back to booking form
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight break-words">Edit question</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <FieldForm action={updateField.bind(null, field.id)} sessions={sessions} defaultValues={field} submitLabel="Save changes" />
      </div>
      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this question</p>
          <p className="text-sm text-muted">Answers on past bookings stay.</p>
        </div>
        <ConfirmButton
          action={deleteField.bind(null, field.id)}
          confirmText="Delete this question? This can't be undone."
          pendingLabel="Deleting…"
          danger
        >
          Delete question
        </ConfirmButton>
      </div>
    </div>
  );
}
