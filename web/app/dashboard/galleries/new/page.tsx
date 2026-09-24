import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { createGallery } from "../actions";
import { GalleryForm } from "../gallery-form";

export default async function NewGalleryPage() {
  const user = await requirePhotographer();
  const clientOptions = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.photographerId, user.id))
    .orderBy(asc(clients.name));

  return (
    <div className="max-w-2xl">
      <p className="text-sm font-bold tracking-wider text-violet uppercase">Galleries</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">New gallery</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <GalleryForm
          action={createGallery}
          clients={clientOptions}
          submitLabel="Create gallery"
          cancelHref="/dashboard/galleries"
        />
      </div>
    </div>
  );
}
