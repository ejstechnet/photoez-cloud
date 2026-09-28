import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { photos, storeOrderItems, storeOrders } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { makePrintFile } from "@/lib/store/print-file";

// "Download print file": the full-resolution original, cropped exactly the
// way the client framed it, as a high-quality JPEG tagged 300 DPI.
export async function GET(_request: Request, { params }: RouteContext<"/dashboard/store/orders/[id]/file/[itemId]">) {
  const { id, itemId } = await params;
  const user = await requirePhotographer();
  const [row] = await db
    .select({ item: storeOrderItems, orderNumber: storeOrders.orderNumber, fileKey: photos.fileKey })
    .from(storeOrderItems)
    .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
    .leftJoin(photos, eq(photos.id, storeOrderItems.photoId))
    .where(and(eq(storeOrderItems.id, itemId), eq(storeOrders.id, id), eq(storeOrders.photographerId, user.id)));
  if (!row) return new Response("Not found", { status: 404 });
  if (!row.fileKey) return new Response("The photo for this item was deleted from the gallery.", { status: 410 });
  const jpeg = await makePrintFile(row.fileKey, row.item.crop);
  if (!jpeg) return new Response("The photo file is missing.", { status: 410 });
  const safe = (text: string) => text.replace(/[^\w.-]+/g, "_").slice(0, 60);
  const name = `${row.orderNumber}_${safe(row.item.productName)}_${safe(row.item.variantLabel)}_${safe((row.item.photoName ?? "photo").replace(/\.\w+$/, ""))}.jpg`;
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
