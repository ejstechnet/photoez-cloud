import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { galleries, photographers, photos, storeDesigns, storeOrderItems, storeOrders } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { formatDate } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { trackingUrl } from "@/lib/store/rules";
import { StoreOrderPill } from "../status-pill";
import { ShipForm } from "./ship-form";
import { RetryLab } from "./retry-lab";

export const metadata: Metadata = { title: "Store order" };

// One store order: what to make (with each item's print file), where to
// send it, and "Mark shipped".
export default async function StoreOrderPage({ params }: PageProps<"/dashboard/store/orders/[id]">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();
  const [[row], [studio]] = await Promise.all([
    db
      .select({ order: storeOrders, galleryTitle: galleries.title })
      .from(storeOrders)
      .leftJoin(galleries, eq(galleries.id, storeOrders.galleryId))
      .where(and(eq(storeOrders.id, id), eq(storeOrders.photographerId, user.id))),
    db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id)),
  ]);
  if (!row) notFound();
  const { order } = row;
  const items = await Promise.all(
    (
      await db
        .select({ item: storeOrderItems, fileKey: photos.fileKey, design: { previewKey: storeDesigns.previewKey, backKey: storeDesigns.backKey } })
        .from(storeOrderItems)
        .leftJoin(photos, eq(photos.id, storeOrderItems.photoId))
        .leftJoin(storeDesigns, eq(storeDesigns.id, storeOrderItems.designId))
        .where(eq(storeOrderItems.orderId, order.id))
    ).map(async ({ item, fileKey, design }) => ({
      ...item,
      // Designed items show the design on the product.
      designed: Boolean(design?.previewKey),
      hasBack: Boolean(design?.backKey),
      thumbUrl: design?.previewKey
        ? await signedViewUrl(design.previewKey)
        : fileKey
          ? await signedViewUrl(photoKey(fileKey, "thumb"))
          : null,
    })),
  );
  const track = trackingUrl(order.carrier, order.trackingNumber);
  const labTrack = trackingUrl(order.labCarrier, order.labTracking);
  const hasSelf = items.some((i) => i.fulfillment === "self");
  const hasLab = items.some((i) => i.fulfillment === "swaggpress");

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/store/orders" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Store orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">{order.orderNumber}</h1>
        <StoreOrderPill status={order.status} />
      </div>
      <p className="mt-1 text-muted">
        {order.clientName ?? "Client"}
        {order.clientEmail && (
          <>
            {" · "}
            <a href={`mailto:${order.clientEmail}`} className="link">
              {order.clientEmail}
            </a>
          </>
        )}
        {order.paidAt && ` · Paid ${formatDate(order.paidAt, studio.timeZone, "short")}`}
        {order.galleryId && row.galleryTitle && (
          <>
            {" · "}
            <Link href={`/dashboard/galleries/${order.galleryId}`} className="link">
              {row.galleryTitle}
            </Link>
          </>
        )}
      </p>

      <section className="card mt-8 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">Items to make</h2>
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-4 py-4">
              {item.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbUrl} alt="" className={`rounded-xl ${item.designed ? "size-24 bg-white object-contain" : "size-16 object-cover"}`} />
              ) : (
                <span className="grid size-16 place-items-center rounded-xl bg-border text-xs text-muted">Deleted</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {item.quantity} × {item.productName} · {item.variantLabel}
                  {item.fulfillment === "swaggpress" && (
                    <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-xs font-bold text-coral uppercase">SwaggPress</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted">
                  {item.options && Object.keys(item.options).length > 0 && (
                    <span className="mr-2 font-semibold text-foreground">
                      {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(" · ")} ·
                    </span>
                  )}
                  {item.designed ? "Designed by the client" : item.photoName}
                  {item.crop ? " · cropped by the client" : ""}
                </p>
              </div>
              <span className="text-sm font-semibold">{formatPrice(item.unitCents * item.quantity)}</span>
              {item.thumbUrl && (
                <a href={`/dashboard/store/orders/${order.id}/file/${item.id}`} className="btn-secondary px-4 py-2 text-xs">
                  Download print file{item.hasBack ? " (front)" : ""}
                </a>
              )}
              {item.hasBack && (
                <a href={`/dashboard/store/orders/${order.id}/file/${item.id}?side=back`} className="btn-secondary px-4 py-2 text-xs">
                  Print file (back)
                </a>
              )}
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatPrice(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping{order.labShippingService ? ` (incl. ${order.labShippingService})` : ""}</dt>
            <dd>{formatPrice(order.shippingCents)}</dd>
          </div>
          {order.handlingCents > 0 && (
            <div className="flex justify-between">
              <dt>Handling</dt>
              <dd>{formatPrice(order.handlingCents)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <dt>Total paid</dt>
            <dd>{formatPrice(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-xl font-bold">Ship to</h2>
          {order.shipLine1 ? (
            <address className="mt-3 not-italic leading-relaxed">
              {order.shipName}
              <br />
              {order.shipLine1}
              {order.shipLine2 && (
                <>
                  <br />
                  {order.shipLine2}
                </>
              )}
              <br />
              {order.shipCity}, {order.shipState} {order.shipPostalCode}
              {order.shipCountry && order.shipCountry !== "US" && (
                <>
                  <br />
                  {order.shipCountry}
                </>
              )}
            </address>
          ) : (
            <p className="mt-3 text-muted">No address yet.</p>
          )}
        </section>
        <div className="space-y-6">
          {hasSelf && (
            <section className="card p-6">
              <h2 className="font-display text-xl font-bold">{hasLab ? "Your items" : "Shipping"}</h2>
              {order.shippedAt ? (
                <p className="mt-3">
                  Shipped {formatDate(order.shippedAt, studio.timeZone, "short")}
                  {order.carrier && ` by ${order.carrier}`}
                  {order.trackingNumber && (
                    <>
                      <br />
                      Tracking:{" "}
                      {track ? (
                        <a href={track} target="_blank" rel="noreferrer" className="link">
                          {order.trackingNumber}
                        </a>
                      ) : (
                        order.trackingNumber
                      )}
                    </>
                  )}
                </p>
              ) : order.status === "paid" ? (
                <div className="mt-3">
                  <p className="mb-4 text-sm text-muted">
                    When {hasLab ? "your items are" : "it\u2019s"} on the way, the client gets an email with the tracking link.
                  </p>
                  <ShipForm orderId={order.id} />
                </div>
              ) : (
                <p className="mt-3 text-muted">This order wasn&rsquo;t paid.</p>
              )}
            </section>
          )}
          {hasLab && (
            <section className="card p-6">
              <h2 className="font-display text-xl font-bold">SwaggPress</h2>
              <p className="mt-1 text-xs text-muted">Printed and shipped for you. Charged to your SwaggPress card at wholesale.</p>
              {order.labStatus === "shipped" ? (
                <p className="mt-3">
                  Shipped {order.labShippedAt ? formatDate(order.labShippedAt, studio.timeZone, "short") : ""}
                  {order.labCarrier && ` by ${order.labCarrier}`}
                  {order.labTracking && (
                    <>
                      <br />
                      Tracking:{" "}
                      {labTrack ? (
                        <a href={labTrack} target="_blank" rel="noreferrer" className="link">
                          {order.labTracking}
                        </a>
                      ) : (
                        order.labTracking
                      )}
                    </>
                  )}
                  <br />
                  <span className="text-sm text-muted">Your client was emailed the tracking link.</span>
                </p>
              ) : order.labStatus === "sent" ? (
                <p className="mt-3">
                  Sent to SwaggPress{order.labOrderNumber && <> as order <strong>{order.labOrderNumber}</strong></>}
                  {order.labSubmittedAt && ` on ${formatDate(order.labSubmittedAt, studio.timeZone, "short")}`}. We&rsquo;ll email
                  your client the tracking link when it ships.
                </p>
              ) : order.labStatus === "failed" ? (
                <div className="mt-3">
                  <p className="rounded-xl bg-coral/15 px-4 py-3 text-sm font-semibold text-danger">{order.labError ?? "Sending failed."}</p>
                  <RetryLab orderId={order.id} />
                </div>
              ) : order.status === "paid" ? (
                <p className="mt-3 text-muted">Sending to SwaggPress…</p>
              ) : (
                <p className="mt-3 text-muted">Sent once the client pays.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
