import { redirect } from "next/navigation";
import { z } from "zod";
import { findGalleryByToken } from "@/lib/client-gallery";
import { galleryDesign } from "@/lib/store/designs";
import { signedViewUrl } from "@/lib/storage";

// A saved design's picture, for the cart (a fresh link each time, since the
// cart is kept in the browser for days).
export async function GET(_request: Request, { params }: RouteContext<"/g/[token]/shop/design/[designId]">) {
  const { token, designId } = await params;
  if (!z.uuid().safeParse(designId).success) return new Response("Not found", { status: 404 });
  const gallery = await findGalleryByToken(token);
  const design = gallery ? await galleryDesign(gallery.id, designId) : null;
  if (!design) return new Response("Not found", { status: 404 });
  redirect(await signedViewUrl(design.previewKey));
}
