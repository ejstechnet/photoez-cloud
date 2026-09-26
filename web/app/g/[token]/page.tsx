import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GALLERY_STEPS, PhotoEZCloudMark, WorkflowPills } from "@/components/brand";
import { clientFinals, clientPhotos, findGalleryByToken, isDelivered } from "@/lib/client-gallery";
import { formatBytes } from "@/lib/format";
import { STATUS_STEP } from "@/lib/gallery-status";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { DeliveryGallery } from "./delivery-gallery";
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
  const { preview, paid, payment } = await searchParams;
  const gallery = await findGalleryByToken(token);
  if (!gallery) notFound();

  const studio = gallery.studioName ?? gallery.photographerName;
  const headerUrl = gallery.headerImageKey ? await signedViewUrl(gallery.headerImageKey) : null;
  const logoUrl = gallery.logoKey ? await signedViewUrl(gallery.logoKey) : null;
  const isPreview = preview === "1";

  const delivered = isDelivered(gallery);
  const finals = await clientFinals(gallery);
  const finalTiles = await Promise.all(
    finals.map(async (photo, i) => ({
      id: photo.id,
      number: i + 1,
      name: photo.originalName,
      aspect: photo.aspect,
      thumbUrl: await signedViewUrl(photoKey(photo.fileKey, "thumb")),
      previewUrl: await signedViewUrl(photoKey(photo.fileKey, "preview")),
      // Full-resolution original, via a route that records the download first.
      downloadUrl: `/g/${token}/photo/${photo.id}${isPreview ? "?preview=1" : ""}`,
    })),
  );
  const totalSize = formatBytes(finals.reduce((sum, photo) => sum + (photo.sizeBytes ?? 0), 0));

  const photos = delivered ? [] : await clientPhotos(gallery);
  const tiles = await Promise.all(
    photos.map(async (photo, i) => ({
      id: photo.id,
      number: i + 1,
      name: photo.name,
      // Shown in the lightbox next to the photo number.
      caption: photo.name,
      aspect: photo.aspect,
      url: await signedViewUrl(photoKey(photo.fileKey, photo.variant)),
      selected: photo.selected,
      note: photo.note,
    })),
  );

  return (
    <div className="flex flex-1 flex-col">
      {isPreview && (
        <p className="bg-sun px-4 py-2 text-center text-sm font-semibold text-brand-deep">
          Client preview: this is exactly what your client sees. Selecting is turned off here.
        </p>
      )}
      {/* Studio navigation, so clients can get back to the studio (and book again). */}
      <nav className="border-b border-white/10 bg-brand-deep text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {gallery.studioSlug ? (
            <Link href={`/studio/${gallery.studioSlug}`} className="flex min-w-0 items-center gap-3">
              {logoUrl && (
                <span className="grid size-9 shrink-0 place-items-center rounded-lg p-1" style={{ backgroundColor: gallery.logoBg }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                </span>
              )}
              <span className="truncate font-display text-lg">{studio}</span>
            </Link>
          ) : (
            <span className="truncate font-display text-lg">{studio}</span>
          )}
          {gallery.studioSlug && (
            <div className="ml-auto flex items-center gap-1">
              <Link
                href={`/studio/${gallery.studioSlug}`}
                className="hidden rounded-full px-3 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap text-white/75 uppercase transition hover:bg-white/10 hover:text-white sm:block"
              >
                Studio page
              </Link>
              <Link
                href={`/studio/${gallery.studioSlug}#contact`}
                className="rounded-full px-3 py-1.5 text-xs font-bold tracking-wider whitespace-nowrap text-white/75 uppercase transition hover:bg-white/10 hover:text-white"
              >
                Contact
              </Link>
              <Link
                href={`/studio/${gallery.studioSlug}/book`}
                className="ml-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider whitespace-nowrap text-brand-deep uppercase transition hover:-translate-y-0.5"
              >
                Book a session
              </Link>
            </div>
          )}
        </div>
      </nav>

      <header
        className={`relative overflow-hidden bg-brand text-white ${
          // Full width, as tall as the 16:7 banner the photographer crops to (7/16 of the
          // width), but never taller than 75% of the screen or too short for the title.
          headerUrl ? "flex min-h-72 w-full items-end sm:h-[min(43.75vw,75vh)]" : ""
        }`}
      >
        {headerUrl ? (
          <>
            {/* The photographer's header photo, darkened at the bottom so the title stays readable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headerUrl} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-brand-deep via-brand-deep/55 to-brand-deep/10" />
          </>
        ) : (
          <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-lime/15 blur-3xl" />
        )}
        <div className={`relative mx-auto w-full max-w-6xl px-4 pb-8 ${headerUrl ? "pt-24" : "pt-6"}`}>
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
        ) : delivered ? (
          finalTiles.length === 0 ? (
            <Notice title="Your gallery is being prepared!">{studio} is finishing your photos. Check back soon.</Notice>
          ) : (
            <DeliveryGallery
              token={token}
              preview={isPreview}
              tiles={finalTiles}
              studio={studio}
              clientFirstName={gallery.clientName?.split(" ")[0] ?? null}
              totalSize={totalSize}
            />
          )
        ) : tiles.length === 0 ? (
          <Notice title="Your photos are on their way">
            {studio} is still getting your gallery ready. Check back soon.
          </Notice>
        ) : (
          <>
          {paid === "1" && (
            <p className="mb-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
              Thank you! Your payment went through and your selections are in.
            </p>
          )}
          {payment === "cancelled" && gallery.status === "pending" && (
            <p className="mb-6 rounded-2xl bg-sun/30 px-5 py-4 font-semibold">
              Your payment was cancelled, so nothing was submitted. Your picks are saved: adjust them or submit again.
            </p>
          )}
          <ProofingGallery
            token={token}
            tiles={tiles}
            freeLimit={gallery.freeLimit}
            extraPriceCents={gallery.extraPriceCents}
            notesEnabled={gallery.notesEnabled}
            locked={gallery.status !== "pending"}
            preview={isPreview}
            studio={studio}
            clientFirstName={gallery.clientName?.split(" ")[0] ?? null}
          />
          </>
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
