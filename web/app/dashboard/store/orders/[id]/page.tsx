import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { galleries, photographers, photos, storeOrderItems, storeOrders } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { formatDate } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { photoKey, signedViewUrl } from "@/lib/storage";
import { trackingUrl } from "@/lib/store/rules";
import { StoreOrderPill } from "../status-pill";
import { ShipForm } from "./ship-form";

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
        .select({ item: storeOrderItems, fileKey: photos.fileKey })
        .from(storeOrderItems)
        .leftJoin(photos, eq(photos.id, storeOrderItems.photoId))
        .where(eq(storeOrderItems.orderId, order.id))
    ).map(async ({ item, fileKey }) => ({ ...item, thumbUrl: fileKey ? await signedViewUrl(photoKey(fileKey, "thumb")) : null })),
  );
  const track = trackingUrl(order.carrier, order.trackingNumber);

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
                <img src={item.thumbUrl} alt="" className="size-16 rounded-xl object-cover" />
              ) : (
                <span className="grid size-16 place-items-center rounded-xl bg-border text-xs text-muted">Deleted</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {item.quantity} × {item.productName} · {item.variantLabel}
                </p>
                <p className="truncate text-sm text-muted">
                  {item.photoName}
                  {item.crop ? " · cropped by the client" : ""}
                </p>
              </div>
              <span className="text-sm font-semibold">{formatPrice(item.unitCents * item.quantity)}</span>
              {item.thumbUrl && (
                <a href={`/dashboard/store/orders/${order.id}/file/${item.id}`} className="btn-secondary px-4 py-2 text-xs">
                  Download print file
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
            <dt>Shipping</dt>
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
        <section className="card p-6">
          <h2 className="font-display text-xl font-bold">Shipping</h2>
          {order.status === "shipped" ? (
            <p className="mt-3">
              Shipped {order.shippedAt ? formatDate(order.shippedAt, studio.timeZone, "short") : ""}
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
              <p className="mb-4 text-sm text-muted">When it&rsquo;s on its way, the client gets an email with the tracking link.</p>
              <ShipForm orderId={order.id} />
            </div>
          ) : (
            <p className="mt-3 text-muted">This order wasn&rsquo;t paid.</p>
          )}
        </section>
      </div>
    </div>
  );
}
