import { and, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { photographers, photos, storeDesigns, storeOrderItems, storeOrders } from "@/db/schema";
import { emailStoreOrderShipped } from "@/lib/email/notify";
import { openSecret } from "@/lib/secret-box";
import { makePrintFile } from "@/lib/store/print-file";
import { photoKey, putObject, signedViewUrl, storeOrderFileKey } from "@/lib/storage";
import { fieldUploadUrls, isFieldUpload } from "@/lib/store/field-uploads";
import { swaggOrderStatus, swaggPlaceOrder } from "./client";

// Store orders with SwaggPress items: sent to SwaggPress once paid, then
// watched until they ship. SwaggPress charges the studio's card on file at
// wholesale; sending the same order twice never charges twice (the store
// order number is the partner_ref).
//
// An order counts as shipped when every part is on its way: the studio's
// own items (marked shipped in the dashboard) and the SwaggPress items.

// Sends a paid order's SwaggPress items. Safe to call again (a retry, or the
// 15-minute job catching up); failures are saved on the order for the
// dashboard's Retry button.
export async function submitLabOrder(orderId: string): Promise<{ ok: true } | { error: string }> {
  const [row] = await db
    .select({ order: storeOrders, key: photographers.swaggpressKey })
    .from(storeOrders)
    .innerJoin(photographers, eq(photographers.id, storeOrders.photographerId))
    .where(eq(storeOrders.id, orderId));
  if (!row) return { error: "That order could not be found." };
  const { order } = row;
  if (order.status === "pending_payment" || order.status === "cancelled") return { error: "Only paid orders are sent to SwaggPress." };
  if (order.labStatus === "sent" || order.labStatus === "shipped" || order.labStatus === "none") return { ok: true };

  const fail = async (message: string) => {
    await db.update(storeOrders).set({ labStatus: "failed", labError: message.slice(0, 500) }).where(eq(storeOrders.id, orderId));
    return { error: message };
  };
  const key = row.key ? openSecret(row.key) : null;
  if (!key) return fail("SwaggPress isn't connected. Connect it in Store → Products & settings, then retry.");
  if (!order.shipLine1 || !order.shipCity || !order.shipState || !order.shipPostalCode) return fail("The order has no shipping address.");

  const items = await db
    .select({ item: storeOrderItems, fileKey: photos.fileKey, design: storeDesigns })
    .from(storeOrderItems)
    .leftJoin(photos, eq(photos.id, storeOrderItems.photoId))
    .leftJoin(storeDesigns, eq(storeDesigns.id, storeOrderItems.designId))
    .where(and(eq(storeOrderItems.orderId, orderId), eq(storeOrderItems.fulfillment, "swaggpress")));
  if (items.length === 0) {
    await db.update(storeOrders).set({ labStatus: "none" }).where(eq(storeOrders.id, orderId));
    return { ok: true };
  }

  // Print-ready files, uploaded privately; SwaggPress downloads them right away.
  const lines = [];
  for (const { item, fileKey, design } of items) {
    // Designed in the gallery: the design's own print files (already print-ready).
    if (item.designId || design) {
      if (!design) return fail(`The design for "${item.productName}" is missing.`);
      lines.push({
        ...(item.labVariantId ? { variant_id: item.labVariantId } : { product_id: item.labProductId! }),
        qty: item.quantity,
        image_url: await signedViewUrl(design.frontKey),
        ...(design.backKey ? { back_image_url: await signedViewUrl(design.backKey) } : {}),
        preview_url: await signedViewUrl(design.previewKey),
        // Full wrap on a "customer chooses" product (SwaggPress adds its upcharge).
        print_style: (design.design as { printStyle?: string }).printStyle === "wrap" ? ("wrap" as const) : ("panel" as const),
        options: item.options ?? {},
        note: `${item.productName} · ${item.variantLabel} · designed by the client`,
      });
      continue;
    }
    if (!fileKey) return fail(`The photo for "${item.productName}" was deleted from the gallery.`);
    const jpeg = await makePrintFile(fileKey, item.crop);
    if (!jpeg) return fail(`The photo file for "${item.productName}" is missing.`);
    const storageKey = storeOrderFileKey(order.photographerId, orderId, item.id);
    await putObject(storageKey, new Uint8Array(jpeg), "image/jpeg");
    lines.push({
      ...(item.labVariantId ? { variant_id: item.labVariantId } : { product_id: item.labProductId! }),
      qty: item.quantity,
      image_url: await signedViewUrl(storageKey),
      options: item.options ?? {},
      // Custom Text & Photos: the answers, and the chosen photos (full resolution).
      ...(item.fields ? { custom_text: item.fields } : {}),
      ...(item.fieldPhotoIds?.length
        ? { asset_urls: await fieldPhotoUrls(item.fieldPhotoIds, order.photographerId, order.galleryId) }
        : {}),
      note: `${item.productName} · ${item.variantLabel}${item.photoName ? ` · photo ${item.photoName}` : ""}`,
    });
  }

  try {
    const sent = await swaggPlaceOrder(key, {
      partner_ref: order.orderNumber,
      items: lines,
      ship_to: {
        name: order.shipName ?? order.clientName ?? "Customer",
        line1: order.shipLine1,
        line2: order.shipLine2 ?? "",
        city: order.shipCity,
        state: order.shipState,
        zip: order.shipPostalCode,
      },
      shipping_rate_id: order.labRateId ?? "flat",
    });
    await db
      .update(storeOrders)
      .set({ labStatus: "sent", labOrderNumber: sent.order_number, labError: null, labSubmittedAt: new Date() })
      .where(eq(storeOrders.id, orderId));
    return { ok: true };
  } catch (error) {
    return fail((error as Error).message);
  }
}

// Links for SwaggPress to download photo fields' photos: gallery originals,
// and files the client uploaded.
async function fieldPhotoUrls(entries: string[], photographerId: string, galleryId: string | null) {
  const ids = entries.filter((e) => !isFieldUpload(e));
  const uploads = entries.filter(isFieldUpload);
  const rows = ids.length ? await db.select({ id: photos.id, fileKey: photos.fileKey }).from(photos).where(inArray(photos.id, ids)) : [];
  const galleryUrls = await Promise.all(rows.map((r) => signedViewUrl(photoKey(r.fileKey, "original"))));
  const uploadUrls = galleryId && uploads.length ? await fieldUploadUrls(photographerId, galleryId, uploads) : [];
  return [...galleryUrls, ...uploadUrls];
}

// The overall status: shipped once every part is on its way.
export async function refreshOrderShipped(orderId: string) {
  const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, orderId));
  if (!order || order.status !== "paid") return;
  const [self] = await db
    .select({ id: storeOrderItems.id })
    .from(storeOrderItems)
    .where(and(eq(storeOrderItems.orderId, orderId), eq(storeOrderItems.fulfillment, "self")))
    .limit(1);
  const selfDone = !self || order.shippedAt !== null;
  const labDone = order.labStatus === "none" || order.labStatus === "shipped";
  if (selfDone && labDone) await db.update(storeOrders).set({ status: "shipped" }).where(eq(storeOrders.id, orderId));
}

// The 15-minute job: sends paid orders that haven't gone to SwaggPress yet,
// and checks sent ones for tracking. Returns how many shipped this run.
export async function runLabOrders(now = new Date()) {
  // Paid but not sent (e.g. the send right after payment didn't finish).
  const waiting = await db
    .select({ id: storeOrders.id })
    .from(storeOrders)
    .where(and(eq(storeOrders.status, "paid"), eq(storeOrders.labStatus, "pending"), lt(storeOrders.paidAt, new Date(now.getTime() - 5 * 60_000))));
  for (const { id } of waiting) await submitLabOrder(id).catch((error) => console.error("SwaggPress send failed", error));

  // Sent: ask SwaggPress for tracking, a studio at a time.
  const sent = await db
    .select({ id: storeOrders.id, number: storeOrders.orderNumber, photographerId: storeOrders.photographerId })
    .from(storeOrders)
    .where(and(eq(storeOrders.labStatus, "sent"), or(eq(storeOrders.status, "paid"), eq(storeOrders.status, "shipped"))));
  const byStudio = Map.groupBy(sent, (o) => o.photographerId);
  let shipped = 0;
  for (const [photographerId, orders] of byStudio) {
    const [studio] = await db
      .select({ key: photographers.swaggpressKey })
      .from(photographers)
      .where(and(eq(photographers.id, photographerId), isNotNull(photographers.swaggpressKey)));
    const key = studio?.key ? openSecret(studio.key) : null;
    if (!key) continue;
    let statuses;
    try {
      statuses = await swaggOrderStatus(key, orders.map((o) => o.number));
    } catch (error) {
      console.error("SwaggPress status check failed", error);
      continue;
    }
    for (const s of statuses) {
      if (s.status !== "shipped" && s.status !== "delivered") continue;
      const order = orders.find((o) => o.number === s.partner_ref);
      if (!order) continue;
      const claimed = await db
        .update(storeOrders)
        .set({ labStatus: "shipped", labCarrier: s.carrier, labTracking: s.tracking_number, labShippedAt: now })
        .where(and(eq(storeOrders.id, order.id), eq(storeOrders.labStatus, "sent")))
        .returning({ id: storeOrders.id });
      if (claimed.length === 0) continue;
      await refreshOrderShipped(order.id);
      await emailStoreOrderShipped(order.id, "lab");
      shipped++;
    }
  }
  return shipped;
}

// Orders a studio's dashboard shows as waiting on SwaggPress (for badges).
export async function labOrdersNeedingAttention(photographerId: string) {
  return db
    .select({ id: storeOrders.id })
    .from(storeOrders)
    .where(and(eq(storeOrders.photographerId, photographerId), inArray(storeOrders.labStatus, ["failed"])));
}
