import { clientFinals, findGalleryByToken, isDelivered } from "@/lib/client-gallery";
import { designPhoto } from "@/lib/store/designs";

// A final photo for the gallery designer, from this site (so the designer can
// draw it into print files; storage links from another address can't be).
// Clients already download these photos from their delivered gallery.
export async function GET(_request: Request, { params }: RouteContext<"/g/[token]/shop/photo/[photoId]">) {
  const { token, photoId } = await params;
  const gallery = await findGalleryByToken(token);
  if (!gallery || !isDelivered(gallery)) return new Response("Not found", { status: 404 });
  const photo = (await clientFinals(gallery)).find((p) => p.id === photoId);
  if (!photo) return new Response("Not found", { status: 404 });
  const bytes = await designPhoto(photo.fileKey);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
