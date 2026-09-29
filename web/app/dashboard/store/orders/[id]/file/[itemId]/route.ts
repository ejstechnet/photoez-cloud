import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { redirect } from "next/navigation";
import { photos, storeDesigns, storeOrderItems, storeOrders } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { makePrintFile } from "@/lib/store/print-file";
import { signedViewUrl } from "@/lib/storage";

// "Download print file": the full-resolution original, cropped exactly the
// way the client framed it, as a high-quality JPEG tagged 300 DPI. Items the
// client designed download the design's own print file (?side=back for the back).
export async function GET(request: Request, { params }: RouteContext<"/dashboard/store/orders/[id]/file/[itemId]">) {
  const { id, itemId } = await params;
  const user = await requirePhotographer();
  const [row] = await db
    .select({ item: storeOrderItems, orderNumber: storeOrders.orderNumber, fileKey: photos.fileKey, design: storeDesigns })
    .from(storeOrderItems)
    .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
    .leftJoin(photos, eq(photos.id, storeOrderItems.photoId))
    .leftJoin(storeDesigns, eq(storeDesigns.id, storeOrderItems.designId))
    .where(and(eq(storeOrderItems.id, itemId), eq(storeOrders.id, id), eq(storeOrders.photographerId, user.id)));
  if (!row) return new Response("Not found", { status: 404 });
  const safe = (text: string) => text.replace(/[^\w.-]+/g, "_").slice(0, 60);
  if (row.design) {
    const back = new URL(request.url).searchParams.get("side") === "back";
    const key = back ? row.design.backKey : row.design.frontKey;
    if (!key) return new Response("This design has no back.", { status: 404 });
    redirect(await signedViewUrl(key, { downloadAs: `${row.orderNumber}_${safe(row.item.productName)}_${safe(row.item.variantLabel)}_${back ? "back" : "front"}.png` }));
  }
  if (!row.fileKey) return new Response("The photo for this item was deleted from the gallery.", { status: 410 });
  const jpeg = await makePrintFile(row.fileKey, row.item.crop);
  if (!jpeg) return new Response("The photo file is missing.", { status: 410 });
  const name = `${row.orderNumber}_${safe(row.item.productName)}_${safe(row.item.variantLabel)}_${safe((row.item.photoName ?? "photo").replace(/\.\w+$/, ""))}.jpg`;
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
