import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessionTypes } from "@/db/schema";
import { richTextHtml } from "@/lib/rich-text";
import { requirePhotographer } from "@/lib/session";
import { signedViewUrl } from "@/lib/storage";
import { deleteSessionType, updateSessionType } from "../../actions";
import { SessionTypeForm } from "../../session-type-form";
import { ConfirmButton } from "../../confirm-button";
import { SessionPhoto } from "./session-photo";

export default async function EditSessionTypePage({ params, searchParams }: PageProps<"/dashboard/bookings/sessions/[id]">) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [sessionType] = await db
    .select()
    .from(sessionTypes)
    .where(and(eq(sessionTypes.id, id), eq(sessionTypes.photographerId, user.id)));
  if (!sessionType) notFound();

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold tracking-wider text-violet uppercase">Booking setup</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{sessionType.name}</h1>
      {added === "1" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Session added! Give it a photo below, or head back to{" "}
          <Link href="/dashboard/bookings/setup" className="link">
            Booking setup
          </Link>
          .
        </p>
      )}
      <div className="card mt-8 p-6 sm:p-8">
        <SessionPhoto
          sessionTypeId={sessionType.id}
          currentUrl={sessionType.imageKey ? await signedViewUrl(sessionType.imageKey) : null}
        />
      </div>
      <div className="card mt-6 p-6 sm:p-8">
        <SessionTypeForm
          action={updateSessionType.bind(null, sessionType.id)}
          defaultValues={{ ...sessionType, description: richTextHtml(sessionType.description) }}
          submitLabel="Save changes"
        />
      </div>
      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this session</p>
          <p className="text-sm text-muted">Bookings already made for it stay exactly as they are.</p>
        </div>
        <ConfirmButton
          action={deleteSessionType.bind(null, sessionType.id)}
          confirmText={`Delete ${sessionType.name}? This can't be undone.`}
          pendingLabel="Deleting…"
          danger
        >
          Delete session
        </ConfirmButton>
      </div>
    </div>
  );
}
