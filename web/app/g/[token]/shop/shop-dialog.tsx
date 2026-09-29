"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import type { StoreCrop } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import type { Storefront } from "@/lib/store/checkout";
import { MAX_QUANTITY, centeredCrop, checkFields, itemUnitCents, optionsCents, shownOptions, variantRatio } from "@/lib/store/rules";
import { DesignerOverlay, type SavedDesign } from "./designer-overlay";
import { PersonalizeFields } from "./personalize-fields";

export type ShopPhoto = { id: string; number: number; name: string; aspect: number; previewUrl: string; thumbUrl: string };

// Ordering one photo: pick a product, a size, crop the photo to that size's
// shape (prints) or design it (SwaggPress merch, in the gallery designer),
// and how many. Adds a line to the cart.
export function ShopDialog({
  token,
  photo,
  photos,
  store,
  onAdd,
  onClose,
}: {
  token: string;
  photo: ShopPhoto;
  // Every photo in the gallery, for designs with more than one.
  photos: ShopPhoto[];
  store: Storefront;
  onAdd: (item: {
    productId: string;
    variantId: string;
    photoId: string;
    quantity: number;
    crop: StoreCrop | null;
    designId: string | null;
    wrap: boolean;
    options: Record<string, string>;
    fields: Record<string, string>;
    fieldPhotos: Record<string, string[]>;
  }) => void;
  onClose: () => void;
}) {
  const [productId, setProductId] = useState(store.products.length === 1 ? store.products[0].id : null);
  const product = store.products.find((p) => p.id === productId) ?? null;
  const [variantId, setVariantId] = useState<string | null>(null);
  const variant = product?.variants.find((v) => v.id === variantId) ?? null;
  // Merch with a design setup is designed instead of cropped.
  const designable = Boolean(product?.design);
  const [design, setDesign] = useState<SavedDesign | null>(null);
  const [designing, setDesigning] = useState(false);
  const wrap = design?.printStyle === "wrap";
  // Options besides size (e.g. Trim), each choice may change the price.
  const [picks, setPicks] = useState<Record<string, string>>({});
  const productOptions = product?.options ?? [];
  // Required options start on their first choice.
  const effectivePicks = Object.fromEntries(
    productOptions.map((o) => [o.name, picks[o.name] ?? (o.required ? o.choices[0].label : "")]),
  );
  // Options that only show when an earlier option has a certain choice.
  const visibleOptions = shownOptions(productOptions, effectivePicks);
  const pickedOptions = optionsCents(productOptions, effectivePicks);
  const optionsReady = !("error" in pickedOptions);
  const unitCents = variant ? itemUnitCents(variant, product?.design, wrap, optionsReady ? pickedOptions.cents : 0) : 0;
  // Custom Text & Photos products: fill in the fields SwaggPress asks for.
  const productFields = product?.fields ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fieldPhotos, setFieldPhotos] = useState<Record<string, string[]>>({});
  // The first photo field starts with the photo the client tapped.
  const firstPhotoField = productFields.find((f) => f.type === "image");
  const effectiveFieldPhotos =
    firstPhotoField && fieldPhotos[firstPhotoField.key] === undefined ? { ...fieldPhotos, [firstPhotoField.key]: [photo.id] } : fieldPhotos;
  const filled = checkFields(productFields, optionsReady ? pickedOptions.picks : {}, answers, effectiveFieldPhotos);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // Sizes with a width and height are cropped to that shape; others aren't.
  const ratio = variant && !designable ? variantRatio(variant) : null;
  // The crop frame follows the photo's orientation until the client turns it.
  const [landscape, setLandscape] = useState(photo.aspect >= 1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<StoreCrop | null>(null);
  const [quantity, setQuantity] = useState(1);
  const onCropComplete = useCallback(
    (pct: Area) => setArea({ x: pct.x / 100, y: pct.y / 100, width: pct.width / 100, height: pct.height / 100 }),
    [],
  );

  function add() {
    if (!product || !variant) return;
    if (designable && !design) return;
    if (!optionsReady) return;
    if ("error" in filled) {
      setFieldError(filled.error);
      return;
    }
    const crop = ratio ? (area ?? centeredCrop({ width: photo.aspect, height: 1 }, ratio)) : null;
    onAdd({
      productId: product.id,
      variantId: variant.id,
      photoId: photo.id,
      quantity,
      crop,
      designId: design?.id ?? null,
      wrap,
      options: optionsReady ? pickedOptions.picks : {},
      fields: answers,
      fieldPhotos: effectiveFieldPhotos,
    });
  }

  const pill = (active: boolean) =>
    `rounded-2xl border-2 px-4 py-3 text-left transition ${active ? "border-lime bg-lime/15" : "border-border hover:border-brand"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Order this photo">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumbUrl} alt="" className="size-14 rounded-xl object-cover" />
            <div>
              <h2 className="font-display text-2xl font-bold">Order photo {photo.number}</h2>
              <p className="text-sm text-muted">{photo.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-2xl leading-none text-muted hover:text-foreground" aria-label="Close">
            ×
          </button>
        </div>

        <p className="mt-6 text-sm font-bold tracking-wider text-muted uppercase">1 · Choose a product</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {store.products.map((p) => (
            <button
              key={p.id}
              type="button"
              className={pill(p.id === productId)}
              onClick={() => {
                setProductId(p.id);
                setVariantId(null);
                setArea(null);
                setDesign(null);
                setPicks({});
                setAnswers({});
                setFieldPhotos({});
                setFieldError(null);
              }}
            >
              <span className="flex items-center gap-3">
                {p.imageUrls[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrls[0]} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                )}
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-sm text-muted">
                    From {formatPrice(Math.min(...p.variants.map((v) => v.priceCents)))}
                    {p.description ? ` · ${p.description}` : ""}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {product && product.imageUrls.length > 0 && (
          <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1">
            {product.imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${product.name}, example ${i + 1}`}
                className="h-40 w-auto shrink-0 snap-start rounded-2xl object-cover sm:h-48"
              />
            ))}
          </div>
        )}

        {product && (
          <>
            <p className="mt-6 text-sm font-bold tracking-wider text-muted uppercase">2 · Choose a size</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`${pill(v.id === variantId)} py-2`}
                  onClick={() => {
                    setVariantId(v.id);
                    setArea(null);
                    setDesign(null);
                    setCropPos({ x: 0, y: 0 });
                    setZoom(1);
                  }}
                >
                  <span className="font-semibold">{v.label}</span> <span className="text-sm text-muted">{formatPrice(v.priceCents)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {variant && visibleOptions.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {visibleOptions.map((o) => (
              <label key={o.name} className="block">
                <span className="text-sm font-bold tracking-wider text-muted uppercase">
                  {o.name}
                  {o.required ? "" : " (optional)"}
                </span>
                <select
                  className="mt-1.5 h-11 w-full rounded-xl border-2 border-border bg-background px-3"
                  value={effectivePicks[o.name] ?? ""}
                  onChange={(e) => setPicks((prev) => ({ ...prev, [o.name]: e.target.value }))}
                >
                  {!o.required && <option value="">None</option>}
                  {o.choices.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                      {c.modCents ? ` (${c.modCents > 0 ? "+" : "−"}${formatPrice(Math.abs(c.modCents))})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {variant && productFields.length > 0 && (
          <>
            <p className="mt-6 text-sm font-bold tracking-wider text-muted uppercase">3 · Personalize</p>
            <p className="mt-1 text-sm text-muted">Tell us what to put on it. We&rsquo;ll create it for you.</p>
            <PersonalizeFields
              fields={productFields}
              optionPicks={optionsReady ? pickedOptions.picks : {}}
              answers={answers}
              onAnswer={(key, value) => {
                setAnswers((prev) => ({ ...prev, [key]: value }));
                setFieldError(null);
              }}
              photoPicks={effectiveFieldPhotos}
              onPhotos={(key, ids) => {
                setFieldPhotos((prev) => ({ ...prev, [key]: ids }));
                setFieldError(null);
              }}
              photos={photos}
            />
          </>
        )}

        {variant && ratio && (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold tracking-wider text-muted uppercase">3 · Frame your print</p>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setLandscape((l) => !l)}>
                ⟳ {landscape ? "Make it tall" : "Make it wide"}
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">Drag and zoom so everything you want is inside the frame. That&rsquo;s exactly what prints.</p>
            <div className="relative mt-3 h-[45vh] min-h-64 overflow-hidden rounded-2xl bg-black">
              <Cropper
                key={`${variant.id}-${landscape}`}
                image={photo.previewUrl}
                crop={cropPos}
                zoom={zoom}
                aspect={landscape ? ratio : 1 / ratio}
                onCropChange={setCropPos}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
              />
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm font-semibold">
              Zoom
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-lime-ink" />
            </label>
          </>
        )}

        {variant && product?.design && (
          <>
            <p className="mt-6 text-sm font-bold tracking-wider text-muted uppercase">3 · Design it</p>
            {design ? (
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={design.previewUrl} alt="Your design" className="h-48 w-auto rounded-2xl border-2 border-border bg-white object-contain" />
                <div>
                  {product.design.wrapChoice && (
                    <p className="mb-2 text-sm font-semibold">
                      {wrap
                        ? `Full wrap${product.design.wrapUpchargeCents ? ` (+${formatPrice(product.design.wrapUpchargeCents)})` : ""}`
                        : product.design.back
                          ? "Front & back"
                          : "Front"}
                    </p>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => setDesigning(true)}>
                    Change my design
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Place your photo, add text, try effects and edges, and use more than one photo if you like.
                </p>
                <button type="button" className="btn-primary mt-3" onClick={() => setDesigning(true)}>
                  🎨 Start designing
                </button>
              </>
            )}
          </>
        )}

        {designing && product?.design && variant && (
          <DesignerOverlay
            token={token}
            productId={product.id}
            productName={product.name}
            setup={product.design}
            variant={variant}
            photos={photos}
            startPhotoId={photo.id}
            initialDesign={design?.design ?? null}
            onSaved={(saved) => {
              setDesign(saved);
              setDesigning(false);
            }}
            onClose={() => setDesigning(false)}
          />
        )}

        {variant && (!designable || design) && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <label className="flex items-center gap-3 text-sm font-semibold">
              Quantity
              <input
                type="number"
                min={1}
                max={MAX_QUANTITY}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_QUANTITY, Number(e.target.value) || 1)))}
                className="h-10 w-20 rounded-xl border-2 border-border bg-background px-3"
              />
            </label>
            <button type="button" className="btn-primary" onClick={add}>
              Add to cart · {formatPrice(unitCents * quantity)}
            </button>
            {fieldError && (
              <p className="w-full text-right text-sm font-semibold text-danger" role="alert">
                {fieldError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
