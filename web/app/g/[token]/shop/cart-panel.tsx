"use client";

import { useState, useTransition } from "react";
import { formatPrice } from "@/lib/booking/format";
import type { Storefront } from "@/lib/store/checkout";
import { cartTotals, checkFields, itemUnitCents, optionsCents } from "@/lib/store/rules";
import { checkoutStoreCart, quoteCartShipping } from "../actions";
import type { ShopPhoto } from "./shop-dialog";
import type { useCart } from "./use-cart";

// The floating cart button and the cart itself: each line with its photo,
// quantity, and price, the order total, and Checkout. The studio's own items
// get their address on Stripe's page; SwaggPress items need the address here
// first, to pick a live shipping rate.
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
  const [shipTo, setShipTo] = useState({ name: "", line1: "", line2: "", city: "", state: "", zip: "" });
  const [quote, setQuote] = useState<{
    quoteId: string;
    key: string;
    rates: { id: string; label: string; amountCents: number; days: number | null }[];
  } | null>(null);
  const [rateId, setRateId] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();

  // Lines whose product, size, or photo still exist.
  const lines = cart.items.flatMap((item) => {
    const product = store.products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    const photo = photos.find((p) => p.id === item.photoId);
    if (!product || !variant || !photo) return [];
    const picked = optionsCents(product.options, item.options);
    const unitCents = itemUnitCents(variant, product.design, item.printStyle ?? Boolean(item.wrap), "cents" in picked ? picked.cents : 0, Boolean(item.hasBack));
    const filled = checkFields(product.fields, "picks" in picked ? picked.picks : {}, item.fields, item.fieldPhotos);
    const personalized = "text" in filled ? Object.entries(filled.text) : [];
    return [{ item, product, variant, photo, unitCents, personalized }];
  });
  const count = lines.reduce((sum, l) => sum + l.item.quantity, 0);
  const labLines = lines.filter((l) => l.product.fulfillment === "swaggpress");
  // A quote is for these SwaggPress items; changing them needs a new one.
  const labKey = labLines.map((l) => `${l.variant.id}:${l.item.quantity}`).sort().join(",");
  const liveQuote = quote && quote.key === labKey ? quote : null;
  const rate = liveQuote?.rates.find((r) => r.id === rateId) ?? null;
  const needsShipping = labLines.length > 0;
  const totals = cartTotals(
    lines.map((l) => ({ unitCents: l.unitCents, quantity: l.item.quantity, fulfillment: l.product.fulfillment })),
    store,
    rate?.amountCents ?? 0,
  );
  const cartForServer = () =>
    lines.map(({ item }) => ({
      productId: item.productId,
      variantId: item.variantId,
      photoId: item.photoId,
      quantity: item.quantity,
      crop: item.crop,
      designId: item.designId ?? null,
      options: item.options ?? {},
      fields: item.fields ?? {},
      fieldPhotos: item.fieldPhotos ?? {},
    }));

  function getRates() {
    setError(null);
    startQuote(async () => {
      const result = await quoteCartShipping(token, cartForServer(), shipTo);
      if ("error" in result) {
        setError(result.error ?? "Shipping options couldn't be loaded.");
        return;
      }
      setQuote({ quoteId: result.quoteId, key: labKey, rates: result.rates });
      setRateId(result.rates[0]?.id ?? null);
    });
  }

  function checkout() {
    setError(null);
    start(async () => {
      const result = await checkoutStoreCart(
        token,
        cartForServer(),
        needsShipping && liveQuote && rate ? { quoteId: liveQuote.quoteId, rateId: rate.id } : null,
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
                  {lines.map(({ item, product, variant, photo, unitCents, personalized }) => (
                    <li key={item.key} className="flex gap-3">
                      {item.designId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/g/${token}/shop/design/${item.designId}`} alt="Your design" className="size-16 shrink-0 rounded-xl bg-white object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.thumbUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {product.name} · {variant.label}
                        </p>
                        {personalized.length > 0 && (
                          <p className="line-clamp-2 text-xs text-muted">{personalized.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                        )}
                        {item.options && Object.keys(item.options).length > 0 && (
                          <p className="truncate text-xs font-semibold">
                            {Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </p>
                        )}
                        <p className="truncate text-xs text-muted">
                          {item.designId
                            ? `Your design${item.wrap && product.design?.wrapChoice ? " · Full wrap" : item.printStyle === "allover" && product.design?.allOver ? " · All-over" : ""}${item.hasBack && product.design?.back ? " · Front & back" : ""}`
                            : `Photo ${photo.number} · ${photo.name}`}
                        </p>
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
                      <p className="text-sm font-semibold">{formatPrice(unitCents * item.quantity)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lines.length > 0 && needsShipping && (
              <div className="border-t border-border px-5 py-4">
                <p className="font-semibold">Ship to</p>
                <p className="mt-0.5 text-xs text-muted">Some items are printed and shipped by our print partner, so we need your address to show shipping options.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["name", "Full name", "col-span-2"],
                      ["line1", "Street address", "col-span-2"],
                      ["line2", "Apt, suite (optional)", "col-span-2"],
                      ["city", "City", "col-span-2"],
                      ["state", "State (e.g. OR)", ""],
                      ["zip", "ZIP code", ""],
                    ] as const
                  ).map(([field, label, span]) => (
                    <input
                      key={field}
                      aria-label={label}
                      placeholder={label}
                      value={shipTo[field]}
                      onChange={(e) => {
                        setShipTo({ ...shipTo, [field]: e.target.value });
                        setQuote(null);
                      }}
                      className={`h-10 rounded-xl border-2 border-border bg-background px-3 text-sm ${span}`}
                    />
                  ))}
                </div>
                {liveQuote ? (
                  <fieldset className="mt-3 space-y-2">
                    <legend className="sr-only">Shipping options</legend>
                    {liveQuote.rates.map((r) => (
                      <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm ${r.id === rateId ? "border-lime bg-lime/10" : "border-border"}`}>
                        <input type="radio" name="rate" checked={r.id === rateId} onChange={() => setRateId(r.id)} className="accent-lime-ink" />
                        <span className="flex-1">
                          {r.label}
                          {r.days ? <span className="text-muted"> · {r.days} {r.days === 1 ? "day" : "days"}</span> : null}
                        </span>
                        <span className="font-semibold">{formatPrice(r.amountCents)}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <button type="button" className="btn-secondary mt-3 w-full" disabled={quoting} onClick={getRates}>
                    {quoting ? "Finding shipping options…" : "See shipping options"}
                  </button>
                )}
              </div>
            )}
            {lines.length > 0 && (
              <div className="border-t border-border px-5 py-4">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(totals.subtotalCents)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Shipping</dt>
                    <dd>
                      {needsShipping && !rate ? "Choose above" : totals.shippingCents > 0 ? formatPrice(totals.shippingCents) : "Free"}
                    </dd>
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
                <button
                  type="button"
                  className="btn-primary mt-4 w-full"
                  disabled={pending || preview || (needsShipping && !rate)}
                  onClick={checkout}
                >
                  {preview ? "Checkout is off in preview" : pending ? "Opening checkout…" : needsShipping && !rate ? "Choose shipping first" : "Checkout"}
                </button>
                <p className="mt-2 text-center text-xs text-muted">
                  {needsShipping ? "You'll pay on the secure payment page." : "You'll add your shipping address on the secure payment page."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
