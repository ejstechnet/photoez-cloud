import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { photographers, storeOrders } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { formatDate } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { StoreOrderPill } from "./status-pill";

export const metadata: Metadata = { title: "Store orders" };

// Every paid store order, newest first; ones still to ship stand out.
export default async function StoreOrdersPage() {
  const user = await requirePhotographer();
  const [[studio], orders] = await Promise.all([
    db.select({ timeZone: photographers.timeZone }).from(photographers).where(eq(photographers.id, user.id)),
    db
      .select()
      .from(storeOrders)
      .where(and(eq(storeOrders.photographerId, user.id), ne(storeOrders.status, "pending_payment"), ne(storeOrders.status, "cancelled")))
      .orderBy(desc(storeOrders.createdAt))
      .limit(200),
  ]);
  return (
    <div>
      <Link href="/dashboard/store" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Store
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">Store orders</h1>
      {orders.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-muted">No orders yet. Once your store is open, client orders show up here.</p>
      ) : (
        <ul className="card mt-8 divide-y divide-border">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/dashboard/store/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-background">
                <div>
                  <p className="font-semibold">
                    {o.orderNumber} · {o.clientName ?? o.clientEmail ?? "Client"}
                  </p>
                  <p className="text-sm text-muted">{formatDate(o.paidAt ?? o.createdAt, studio.timeZone, "short")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold">{formatPrice(o.totalCents)}</span>
                  <StoreOrderPill status={o.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
