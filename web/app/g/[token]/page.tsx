import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GALLERY_STEPS, PhotoEZCloudMark, WorkflowPills } from "@/components/brand";
import { clientPhotos, findGalleryByToken } from "@/lib/client-gallery";
import { STATUS_STEP } from "@/lib/gallery-status";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { ProofingGallery } from "./proofing-gallery";

// The client's private gallery page, reached from the link the photographer
// shares. No login: the token in the URL is the key.

export async function generateMetadata({ params }: PageProps<"/g/[token]">): Promise<Metadata> {
  const { token } = await params;
  const gallery = await findGalleryByToken(token);
  return {
    title: gallery ? `${gallery.title} · PhotoEZ Cloud` : "Gallery · PhotoEZ Cloud",
    // Private galleries must never show up in search engines.
    robots: { index: false, follow: false },
  };
}

export default async function ClientGalleryPage({ params, searchParams }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const { preview } = await searchParams;
  const gallery = await findGalleryByToken(token);
  if (!gallery) notFound();

  const studio = gallery.studioName ?? gallery.photographerName;
  const isPreview = preview === "1";

  const photos = await clientPhotos(gallery);
  const tiles = await Promise.all(
    photos.map(async (photo, i) => ({
      id: photo.id,
      number: i + 1,
      aspect: photo.aspect,
      url: await signedViewUrl(photoKey(photo.fileKey, photo.variant)),
      selected: photo.selected,
    })),
  );

  return (
    <div className="flex flex-1 flex-col">
      {isPreview && (
        <p className="bg-sun px-4 py-2 text-center text-sm font-semibold text-brand-deep">
          Client preview: this is exactly what your client sees. Selecting is turned off here.
        </p>
      )}
      <header className="relative overflow-hidden bg-brand text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-lime/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-6 pb-8">
          <p className="text-sm font-bold tracking-wider text-sky-light uppercase">{studio}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight break-words sm:text-5xl">
            {gallery.title}
          </h1>
          <div className="mt-6">
            <WorkflowPills steps={GALLERY_STEPS} active={STATUS_STEP[gallery.status]} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {gallery.status === "expired" ? (
          <Notice title="This gallery has expired">
            Contact {studio} if you still need your photos.
          </Notice>
        ) : gallery.status === "delivered" || gallery.status === "completed" ? (
          <Notice title="Your final photos are ready">
            {studio} has delivered your finished photos. Downloads are coming to this page soon.
          </Notice>
        ) : tiles.length === 0 ? (
          <Notice title="Your photos are on their way">
            {studio} is still getting your gallery ready. Check back soon.
          </Notice>
        ) : (
          <ProofingGallery
            token={token}
            tiles={tiles}
            freeLimit={gallery.freeLimit}
            locked={gallery.status !== "pending"}
            preview={isPreview}
            studio={studio}
            clientFirstName={gallery.clientName?.split(" ")[0] ?? null}
          />
        )}
      </main>

      <footer className="border-t border-border py-6">
        <p className="flex items-center justify-center gap-2 text-xs text-muted">
          <PhotoEZCloudMark className="h-5 w-7" /> Gallery by PhotoEZ Cloud
        </p>
      </footer>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mx-auto max-w-xl px-6 py-14 text-center">
      <p className="font-display text-3xl font-bold">{title}</p>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}
