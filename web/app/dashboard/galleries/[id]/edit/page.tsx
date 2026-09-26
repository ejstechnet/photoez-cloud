import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, galleries } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { studioPlan } from "@/lib/studio-plan";
import { galleryHeaderSourceKey, headerSourceVersion, signedViewUrl } from "@/lib/storage";
import { HeaderPhoto } from "./header-photo";
import { prepareGalleryHeaderUpload, removeGalleryHeader, saveGalleryHeader, updateGallery } from "../../actions";
import { GalleryForm } from "../../gallery-form";
import { DeleteGalleryButton } from "./delete-gallery-button";

export default async function EditGalleryPage({ params }: PageProps<"/dashboard/galleries/[id]/edit">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();

  const [gallery] = await db
    .select({
      id: galleries.id,
      title: galleries.title,
      clientId: galleries.clientId,
      freeLimit: galleries.freeLimit,
      headerImageKey: galleries.headerImageKey,
      extraPhotoPriceCents: galleries.extraPhotoPriceCents,
      notesEnabled: galleries.notesEnabled,
    })
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.photographerId, user.id)));
  if (!gallery) notFound();
  const plan = await studioPlan(user.id);
  // Banners saved with an original can be re-cropped.
  const headerSource = gallery.headerImageKey ? headerSourceVersion(gallery.headerImageKey) : null;

  const clientOptions = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.photographerId, user.id))
    .orderBy(asc(clients.name));

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold tracking-wider text-violet uppercase">Gallery settings</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight break-words">{gallery.title}</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <HeaderPhoto
          currentUrl={gallery.headerImageKey ? await signedViewUrl(gallery.headerImageKey) : null}
          sourceUrl={headerSource ? await signedViewUrl(galleryHeaderSourceKey(user.id, gallery.id, headerSource)) : null}
          prepare={prepareGalleryHeaderUpload.bind(null, gallery.id)}
          save={saveGalleryHeader.bind(null, gallery.id)}
          remove={removeGalleryHeader.bind(null, gallery.id)}
        />
      </div>
      <div className="card mt-6 p-6 sm:p-8">
        <GalleryForm
          action={updateGallery.bind(null, gallery.id)}
          clients={clientOptions}
          defaultValues={gallery}
          submitLabel="Save changes"
          cancelHref={`/dashboard/galleries/${gallery.id}`}
          extras={plan.upsells ? { studioPriceCents: plan.extraPhotoPriceCents } : null}
        />
      </div>
      <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Delete this gallery</p>
          <p className="text-sm text-muted">Every photo in it is permanently deleted from storage.</p>
        </div>
        <DeleteGalleryButton galleryId={gallery.id} title={gallery.title} />
      </div>
    </div>
  );
}
