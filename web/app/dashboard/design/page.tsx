import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, studioPhotos } from "@/db/schema";
import { cleanDesign } from "@/lib/design";
import { requirePhotographer } from "@/lib/session";
import { signedViewUrl } from "@/lib/storage";
import { Designer } from "./designer";

export const metadata = { title: "Design · PhotoEZ Cloud" };

// The Page Designer: the look of every page clients see.
export default async function DesignPage() {
  const user = await requirePhotographer();
  const [studio] = await db
    .select({
      design: photographers.design,
      name: photographers.name,
      businessName: photographers.businessName,
      tagline: photographers.studioTagline,
      slug: photographers.studioSlug,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const design = cleanDesign(studio.design);
  // The studio's own portfolio photos fill the preview's gallery.
  const samples = await db
    .select({ fileKey: studioPhotos.fileKey })
    .from(studioPhotos)
    .where(eq(studioPhotos.photographerId, user.id))
    .orderBy(asc(studioPhotos.position))
    .limit(8);

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-violet uppercase">Page Designer</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Design</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Make your studio page, booking pages, gift cards, reviews, and client galleries look like you. Try things in the
        preview; clients see the new look once you save.
      </p>
      <div className="mt-8">
        <Designer
          initial={design}
          bannerPhotoUrl={design.bannerImageKey ? await signedViewUrl(design.bannerImageKey) : null}
          studioName={studio.businessName || studio.name}
          tagline={studio.tagline}
          sampleUrls={await Promise.all(samples.map((s) => signedViewUrl(s.fileKey)))}
          studioUrl={studio.slug ? `/studio/${studio.slug}` : null}
        />
      </div>
    </div>
  );
}
