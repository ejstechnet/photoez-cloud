import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { addons, sessionTypeAddons, sessionTypes } from "@/db/schema";
import { PhotoUpload } from "@/components/photo-upload";
import { requirePhotographer } from "@/lib/session";
import { signedViewUrl } from "@/lib/storage";
import { deleteAddon, prepareAddonImageUpload, removeAddonImage, saveAddonImage, updateAddon } from "../../addon-actions";
import { AddonForm } from "../../addon-form";
import { ConfirmButton } from "../../confirm-button";

export default async function EditAddonPage({ params, searchParams }: PageProps<"/dashboard/bookings/addons/[id]">) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [addon] = await db
    .select()
    .from(addons)
    .where(and(eq(addons.id, id), eq(addons.photographerId, user.id)));
  if (!addon) notFound();

  // Sessions that offer this add-on (set on each session's page).
  const offeredOn = await db
    .select({ id: sessionTypes.id, name: sessionTypes.name, included: sessionTypeAddons.includedQuantity })
    .from(sessionTypeAddons)
    .innerJoin(sessionTypes, eq(sessionTypes.id, sessionTypeAddons.sessionTypeId))
    .where(eq(sessionTypeAddons.addonId, addon.id));

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/bookings/setup#addons" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Booking setup
      </Link>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{addon.name}</h1>

      {added === "1" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Add-on saved! Give it a photo below, then open a session in Booking setup to offer it there.
        </p>
      )}

      <div className="card mt-8 p-6 sm:p-8">
        <PhotoUpload
          label="Add-on photo"
          hint="Shown beside the add-on when clients book. A square photo fits best."
          aspect="square"
          currentUrl={addon.imageKey ? await signedViewUrl(addon.imageKey) : null}
          prepare={prepareAddonImageUpload.bind(null, addon.id)}
          save={saveAddonImage.bind(null, addon.id)}
          remove={removeAddonImage.bind(null, addon.id)}
        />
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <AddonForm action={updateAddon.bind(null, addon.id)} defaultValues={addon} submitLabel="Save changes" />
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">Offered with</h2>
        {offeredOn.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No sessions yet. Open a session in{" "}
            <Link href="/dashboard/bookings/setup" className="link">
              Booking setup
            </Link>{" "}
            and tick this add-on under its Add-ons.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {offeredOn.map((s) => (
              <li key={s.id}>
                <Link href={`/dashboard/bookings/sessions/${s.id}#addons`} className="link">
                  {s.name}
                </Link>
                {s.included > 0 && <span className="text-sm text-muted"> · {s.included} included</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this add-on</p>
          <p className="text-sm text-muted">Bookings that already include it keep it.</p>
        </div>
        <ConfirmButton
          action={deleteAddon.bind(null, addon.id)}
          confirmText={`Delete ${addon.name}? This can't be undone.`}
          pendingLabel="Deleting…"
          danger
        >
          Delete add-on
        </ConfirmButton>
      </div>
    </div>
  );
}
