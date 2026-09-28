import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { storeProducts } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { requirePhotographer } from "@/lib/session";
import { swaggCatalogFor } from "@/lib/swaggpress/catalog";
import { swaggImages } from "@/lib/swaggpress/mapping";
import { AddSwaggButton } from "./add-button";

export const metadata: Metadata = { title: "SwaggPress catalog" };

// The SwaggPress catalog, live: what a connected studio can add to its store.
export default async function SwaggCatalogPage() {
  const user = await requirePhotographer();
  let catalog;
  let error: string | null = null;
  try {
    catalog = await swaggCatalogFor(user.id);
  } catch (e) {
    error = (e as Error).message;
  }
  if (!catalog && !error) redirect("/dashboard/store");
  const added = await db
    .select({ id: storeProducts.id, labProductId: storeProducts.labProductId })
    .from(storeProducts)
    .where(and(eq(storeProducts.photographerId, user.id), eq(storeProducts.fulfillment, "swaggpress")));

  return (
    <div>
      <Link href="/dashboard/store" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Store
      </Link>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">SwaggPress catalog</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Printed and shipped for you by SwaggPress Creations. Prices shown are wholesale, what SwaggPress charges your card.
        Add a product, then set your own prices; each starts at about double wholesale.
      </p>
      {error ? (
        <p className="card mt-8 p-6 font-semibold text-danger">{error}</p>
      ) : catalog!.products.length === 0 ? (
        <p className="card mt-8 p-8 text-center text-muted">SwaggPress hasn&rsquo;t listed any products for partners yet. Check back soon.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {catalog!.products.map((p) => {
            const images = swaggImages(p);
            const prices = p.variants.length ? p.variants.map((v) => v.wholesale_price) : [p.wholesale_price];
            const low = Math.min(...prices);
            const high = Math.max(...prices);
            const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))];
            const colors = [...new Set(p.variants.map((v) => v.color).filter(Boolean))];
            return (
              <li key={p.id} className="card flex flex-col overflow-hidden">
                {images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt={p.name} className="aspect-[4/3] w-full bg-white object-contain" loading="lazy" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-background text-4xl">🛍️</div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-bold tracking-wider text-coral uppercase">{p.category}</p>
                  <h2 className="mt-1 font-display text-xl font-bold">{p.name}</h2>
                  <p className="mt-1 text-sm">
                    Wholesale <strong>{low === high ? formatPrice(low * 100) : `${formatPrice(low * 100)}–${formatPrice(high * 100)}`}</strong>
                  </p>
                  {sizes.length > 0 && <p className="mt-1 text-xs text-muted">Sizes: {sizes.join(", ")}</p>}
                  {colors.length > 0 && <p className="text-xs text-muted">Colors: {colors.join(", ")}</p>}
                  <div className="mt-auto pt-4">
                    <AddSwaggButton labProductId={p.id} addedId={added.find((a) => a.labProductId === p.id)?.id ?? null} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
