import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, inArray, sum } from "drizzle-orm";
import { db } from "@/db";
import { photographers, storeOrderItems, storeOrders, storeProducts } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { paymentAccount } from "@/lib/payments/checkout";
import { requirePhotographer } from "@/lib/session";
import { addStarterPrints } from "./actions";
import { StoreSettingsForm } from "./settings-form";
import { SwaggCard } from "./swagg-card";
import { sellable } from "@/lib/swaggpress/mapping";
import { formatDate, formatTime } from "@/lib/booking/time";
import { signedViewUrl } from "@/lib/storage";

export const metadata: Metadata = { title: "Store" };

// Store: open the shop, set shipping and handling, and manage products.
export default async function StorePage() {
  const user = await requirePhotographer();
  const [[studio], products, [toShip], account, soldRows] = await Promise.all([
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
    // How many of each product clients have bought (paid or shipped orders).
    db
      .select({ productId: storeOrderItems.productId, n: sum(storeOrderItems.quantity) })
      .from(storeOrderItems)
      .innerJoin(storeOrders, eq(storeOrders.id, storeOrderItems.orderId))
      .where(and(eq(storeOrders.photographerId, user.id), inArray(storeOrders.status, ["paid", "shipped"])))
      .groupBy(storeOrderItems.productId),
  ]);
  const sold = new Map(soldRows.map((r) => [r.productId, Number(r.n ?? 0)]));
  // Each product's first picture, for its card.
  const pictures = new Map(
    await Promise.all(
      products.map(async (p) => [p.id, p.fulfillment === "swaggpress" ? (p.labImageUrls[0] ?? null) : p.imageKeys[0] ? await signedViewUrl(p.imageKeys[0]) : null] as const),
    ),
  );

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
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {products.map((p) => {
                const prices = p.variants.filter((v) => v.available !== false).map((v) => v.priceCents);
                const low = prices.length ? Math.min(...prices) : null;
                const high = prices.length ? Math.max(...prices) : null;
                const swagg = p.fulfillment === "swaggpress";
                // SwaggPress sizes clients can't buy (dropped, or priced at/below wholesale).
                const blocked = swagg ? p.variants.filter((v) => !sellable(v)).length : 0;
                const n = sold.get(p.id) ?? 0;
                const picture = pictures.get(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/store/products/${p.id}`}
                      className={`flex h-full items-center gap-4 rounded-2xl border border-border p-4 transition hover:border-brand/40 hover:shadow-sm ${p.active ? "" : "opacity-70"}`}
                    >
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background">
                        {picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={picture} alt="" className="size-full object-contain" />
                        ) : (
                          <span className="text-2xl" aria-hidden="true">🖼️</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="font-display text-2xl font-bold text-brand">
                          {low === null ? "No sizes on sale" : low === high ? formatPrice(low) : `From ${formatPrice(low)}`}
                        </p>
                        <p className="text-sm text-muted">{n > 0 ? `${n} sold` : "None sold yet"}</p>
                        {(!p.active || swagg) && (
                          <p className="mt-1 flex flex-wrap gap-1.5">
                            {!p.active && <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-bold text-muted uppercase">Hidden</span>}
                            {swagg && <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[11px] font-bold text-coral uppercase">SwaggPress</span>}
                          </p>
                        )}
                        {swagg && (p.labUnavailable || blocked > 0) && (
                          <p className="mt-1 text-xs font-semibold text-danger">
                            {p.labUnavailable ? "No longer offered by SwaggPress" : `${blocked} ${blocked === 1 ? "size" : "sizes"} hidden from clients`}
                          </p>
                        )}
                      </div>
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
