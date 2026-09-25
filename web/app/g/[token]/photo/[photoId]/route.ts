import { redirect } from "next/navigation";
import { db } from "@/db";
import { galleryDownloads } from "@/db/schema";
import { clientFinals, findGalleryByToken, isDelivered } from "@/lib/client-gallery";
import { photoKey, signedViewUrl } from "@/lib/storage";

// Downloading one final photo: record it (so the photographer can see the
// client downloaded their photos), then send the browser to the file itself.
// The photographer's own "Preview as client" visits add ?preview=1 and aren't recorded.
export async function GET(request: Request, { params }: RouteContext<"/g/[token]/photo/[photoId]">) {
  const { token, photoId } = await params;
  const gallery = await findGalleryByToken(token);
  if (!gallery || !isDelivered(gallery)) return new Response("Not found", { status: 404 });

  const photo = (await clientFinals(gallery)).find((p) => p.id === photoId);
  if (!photo) return new Response("Not found", { status: 404 });

  if (new URL(request.url).searchParams.get("preview") !== "1") {
    await db.insert(galleryDownloads).values({ galleryId: gallery.id, kind: "photo", photoId: photo.id });
  }
  redirect(await signedViewUrl(photoKey(photo.fileKey, "original"), { downloadAs: photo.originalName }));
}
