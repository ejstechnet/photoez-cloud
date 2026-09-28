"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/booking/format";
import type { Storefront } from "@/lib/store/checkout";
import { cartTotals } from "@/lib/store/rules";
import { checkoutStoreCart } from "../actions";
import type { ShopPhoto } from "./shop-dialog";
import type { useCart } from "./use-cart";

// The floating cart button and the cart itself: each line with its photo,
// quantity, and price, the order total, and Checkout (Stripe, where the
// client also gives their shipping address).
export function CartPanel({
  token,
  store,
  photos,
  cart,
  preview,
}: {
  token: string;
  store: Storefront;
  photos: ShopPhoto[];
  cart: ReturnType<typeof useCart>;
  // The photographer's "Preview as client": checkout is off.
  preview: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Lines whose product, size, or photo still exist.
  const lines = cart.items.flatMap((item) => {
    const product = store.products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const photo = photos.find((p) => p.id === item.photoId);
    return product && variant && photo ? [{ item, product, variant, photo }] : [];
  });
  const count = lines.reduce((sum, l) => sum + l.item.quantity, 0);
  const totals = cartTotals(
    lines.map((l) => ({ unitCents: l.variant.priceCents, quantity: l.item.quantity })),
    store,
  );

  function checkout() {
    setError(null);
    start(async () => {
      const result = await checkoutStoreCart(
        token,
        lines.map(({ item }) => ({
          productId: item.productId,
          variantId: item.variantId,
          photoId: item.photoId,
          quantity: item.quantity,
          crop: item.crop,
        })),
      );
      if ("url" in result) window.location.href = result.url;
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3 font-bold text-white shadow-2xl transition hover:-translate-y-0.5"
      >
        🛍️ Cart
        {count > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-lime px-1.5 text-sm text-on-accent">{count}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Your cart">
          <div className="flex h-full w-full max-w-md flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-2xl font-bold">Your cart</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-2xl leading-none text-muted hover:text-foreground" aria-label="Close cart">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 ? (
                <p className="py-10 text-center text-muted">Your cart is empty. Tap 🛍️ on any photo to order prints and more.</p>
              ) : (
                <ul className="space-y-4">
                  {lines.map(({ item, product, variant, photo }) => (
                    <li key={item.key} className="flex gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.thumbUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {product.name} · {variant.label}
                        </p>
                        <p className="truncate text-xs text-muted">Photo {photo.number} · {photo.name}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" className="size-7 rounded-full border-2 border-border font-bold" onClick={() => cart.setQuantity(item.key, item.quantity - 1)} aria-label="One fewer">
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button type="button" className="size-7 rounded-full border-2 border-border font-bold" onClick={() => cart.setQuantity(item.key, item.quantity + 1)} aria-label="One more">
                            +
                          </button>
                          <button type="button" className="ml-auto text-xs font-semibold text-danger hover:underline" onClick={() => cart.remove(item.key)}>
                            Remove
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">{formatPrice(variant.priceCents * item.quantity)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lines.length > 0 && (
              <div className="border-t border-border px-5 py-4">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(totals.subtotalCents)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Shipping</dt>
                    <dd>{totals.shippingCents > 0 ? formatPrice(totals.shippingCents) : "Free"}</dd>
                  </div>
                  {totals.handlingCents > 0 && (
                    <div className="flex justify-between">
                      <dt>Handling</dt>
                      <dd>{formatPrice(totals.handlingCents)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold">
                    <dt>Total</dt>
                    <dd>{formatPrice(totals.totalCents)}</dd>
                  </div>
                </dl>
                {error && <p className="mt-3 text-sm font-semibold text-danger">{error}</p>}
                <button type="button" className="btn-primary mt-4 w-full" disabled={pending || preview} onClick={checkout}>
                  {preview ? "Checkout is off in preview" : pending ? "Opening checkout…" : "Checkout"}
                </button>
                <p className="mt-2 text-center text-xs text-muted">You&rsquo;ll add your shipping address on the secure payment page.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
