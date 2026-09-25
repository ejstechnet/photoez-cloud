import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { addons, sessionTypeAddons, sessionTypes } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { richTextHtml } from "@/lib/rich-text";
import { requirePhotographer } from "@/lib/session";
import { signedViewUrl } from "@/lib/storage";
import {
  deleteSessionType,
  prepareSessionImageUpload,
  removeSessionImage,
  saveSessionImage,
  updateSessionType,
} from "../../actions";
import { SessionTypeForm } from "../../session-type-form";
import { ConfirmButton } from "../../confirm-button";
import { PhotoUpload } from "@/components/photo-upload";
import { saveSessionAddons } from "../../addon-actions";
import { SessionAddonsForm } from "./session-addons-form";

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

  const [allAddons, linked] = await Promise.all([
    db
      .select({ id: addons.id, name: addons.name, priceCents: addons.priceCents })
      .from(addons)
      .where(eq(addons.photographerId, user.id))
      .orderBy(asc(addons.sortOrder), asc(addons.createdAt)),
    db
      .select({ addonId: sessionTypeAddons.addonId, included: sessionTypeAddons.includedQuantity })
      .from(sessionTypeAddons)
      .where(eq(sessionTypeAddons.sessionTypeId, sessionType.id)),
  ]);
  const linkedById = new Map(linked.map((l) => [l.addonId, l.included]));

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
        <PhotoUpload
          label="Session photo"
          hint="Shown above this session on your booking page as a 2:3 portrait, so a vertical photo fits best."
          aspect="portrait"
          currentUrl={sessionType.imageKey ? await signedViewUrl(sessionType.imageKey) : null}
          prepare={prepareSessionImageUpload.bind(null, sessionType.id)}
          save={saveSessionImage.bind(null, sessionType.id)}
          remove={removeSessionImage.bind(null, sessionType.id)}
        />
      </div>
      <div className="card mt-6 p-6 sm:p-8">
        <SessionTypeForm
          action={updateSessionType.bind(null, sessionType.id)}
          defaultValues={{ ...sessionType, description: richTextHtml(sessionType.description) }}
          submitLabel="Save changes"
        />
      </div>
      <section id="addons" className="card mt-6 scroll-mt-8 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">Add-ons</h2>
        <p className="mt-1 text-sm text-muted">
          Extras clients can add when they book this session. &quot;Included&quot; ones come free; clients pay for more.
        </p>
        <div className="mt-4">
          {allAddons.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border px-5 py-6 text-center text-sm text-muted">
              No add-ons yet.{" "}
              <Link href="/dashboard/bookings/addons/new" className="link">
                Create your first add-on
              </Link>
              .
            </p>
          ) : (
            <SessionAddonsForm
              action={saveSessionAddons.bind(null, sessionType.id)}
              rows={allAddons.map((a) => ({
                id: a.id,
                name: a.name,
                price: formatPrice(a.priceCents),
                offered: linkedById.has(a.id),
                included: linkedById.get(a.id) ?? 0,
              }))}
            />
          )}
        </div>
      </section>

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
