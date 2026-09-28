import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, storeOrders, storeProducts } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { paymentAccount } from "@/lib/payments/checkout";
import { requirePhotographer } from "@/lib/session";
import { addStarterPrints } from "./actions";
import { StoreSettingsForm } from "./settings-form";
import { SwaggCard } from "./swagg-card";
import { sellable } from "@/lib/swaggpress/mapping";
import { formatDate, formatTime } from "@/lib/booking/time";

export const metadata: Metadata = { title: "Store" };

// Store: open the shop, set shipping and handling, and manage products.
export default async function StorePage() {
  const user = await requirePhotographer();
  const [[studio], products, [toShip], account] = await Promise.all([
    db
      .select({
        enabled: photographers.storeEnabled,
        shippingCents: photographers.storeShippingCents,
        handlingCents: photographers.storeHandlingCents,
        swaggKey: photographers.swaggpressKey,
        swaggBusiness: photographers.swaggpressBusiness,
        swaggCard: photographers.swaggpressCardOnFile,
        swaggSyncedAt: photographers.swaggpressSyncedAt,
        timeZone: photographers.timeZone,
      })
      .from(photographers)
      .where(eq(photographers.id, user.id)),
    db
      .select()
      .from(storeProducts)
      .where(eq(storeProducts.photographerId, user.id))
      .orderBy(asc(storeProducts.sortOrder), asc(storeProducts.createdAt)),
    db
      .select({ n: count() })
      .from(storeOrders)
      .where(and(eq(storeOrders.photographerId, user.id), eq(storeOrders.status, "paid"))),
    paymentAccount(user.id),
  ]);

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Online store</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Store</h1>
        <Link href="/dashboard/store/orders" className="btn-secondary">
          Orders{toShip.n > 0 ? ` · ${toShip.n} to ship` : ""}
        </Link>
      </div>
      <p className="mt-2 max-w-3xl text-muted">
        Clients order prints and products of their photos right from their delivered gallery and pay you through Stripe.
        Make and ship items yourself, or let SwaggPress Creations print and ship them for you.
      </p>
      {!account && (
        <p className="mt-6 rounded-2xl bg-sun/30 px-5 py-4 text-sm font-semibold">
          Connect Stripe in{" "}
          <Link href="/dashboard/settings" className="link">
            Settings
          </Link>{" "}
          first. The store only opens when you can take payments.
        </p>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-8">
          <section className="card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">Settings</h2>
            <p className="mt-1 text-sm text-muted">Shipping here is for items you ship yourself. SwaggPress items use live rates.</p>
            <div className="mt-5">
              <StoreSettingsForm enabled={studio.enabled} shippingCents={studio.shippingCents} handlingCents={studio.handlingCents} />
            </div>
          </section>
          <SwaggCard
            business={studio.swaggKey ? studio.swaggBusiness : null}
            cardOnFile={studio.swaggCard}
            syncedAt={studio.swaggSyncedAt ? `${formatDate(studio.swaggSyncedAt, studio.timeZone, "short")} at ${formatTime(studio.swaggSyncedAt, studio.timeZone)}` : null}
          />
        </div>

        <section className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-bold">Products</h2>
            <Link href="/dashboard/store/products/new" className="btn-primary px-4 py-2 text-xs">
              + Add product
            </Link>
          </div>
          {products.length === 0 ? (
            <div className="mt-5 rounded-2xl border-2 border-dashed border-border px-5 py-8 text-center">
              <p className="text-muted">No products yet. Start with the usual print sizes and change the prices to yours.</p>
              <form action={addStarterPrints} className="mt-4">
                <button type="submit" className="btn-secondary">
                  Add starter prints (4×6 to 16×20)
                </button>
              </form>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {products.map((p) => {
                const prices = p.variants.map((v) => v.priceCents);
                const swagg = p.fulfillment === "swaggpress";
                // SwaggPress sizes clients can't buy (dropped, or priced at/below wholesale).
                const blocked = swagg ? p.variants.filter((v) => !sellable(v)).length : 0;
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <div>
                      <p className="font-semibold">
                        {p.name}
                        {!p.active && <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs font-bold text-muted uppercase">Hidden</span>}
                        {swagg && <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 text-xs font-bold text-coral uppercase">SwaggPress</span>}
                      </p>
                      <p className="text-sm text-muted">
                        {p.variants.map((v) => v.label).join(", ")}
                        {prices.length > 0 && ` · ${formatPrice(Math.min(...prices))}–${formatPrice(Math.max(...prices))}`}
                      </p>
                      {swagg && (p.labUnavailable || blocked > 0) && (
                        <p className="text-xs font-semibold text-danger">
                          {p.labUnavailable
                            ? "No longer offered by SwaggPress"
                            : `${blocked} ${blocked === 1 ? "size is" : "sizes are"} hidden (dropped or priced at/below wholesale)`}
                        </p>
                      )}
                    </div>
                    <Link href={`/dashboard/store/products/${p.id}`} className="link text-sm">
                      Edit
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
