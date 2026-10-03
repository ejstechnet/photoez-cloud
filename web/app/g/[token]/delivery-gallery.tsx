"use client";

import { SearchBox } from "./search-box";
import { galleryItemClass, galleryListClass, galleryTileAspect, type GalleryLayout } from "@/lib/gallery-layout";
import { useEffect, useState } from "react";
import type { Storefront } from "@/lib/store/checkout";
import { CartPanel } from "./shop/cart-panel";
import { ShopDialog } from "./shop/shop-dialog";
import { useCart } from "./shop/use-cart";
import { DownloadIcon } from "@/components/icons";
import { Lightbox } from "@/components/lightbox";
import { Slideshow } from "@/components/slideshow";

export type FinalTile = {
  id: string;
  number: number;
  name: string;
  aspect: number;
  thumbUrl: string;
  previewUrl: string;
  downloadUrl: string;
};

// The PhotoEZ "Final delivery" page: clean, unwatermarked finals in the
// masonry grid, a download on every photo, and one ZIP for everything.
export function DeliveryGallery({
  canSearch = false,
  layout = "masonry",
  token,
  preview = false,
  tiles,
  studio,
  clientFirstName,
  totalSize,
  store = null,
  ordered = null,
  orderCancelled = false,
  slideshow = null,
  title = "",
}: {
  // Gallery search is on (the studio's plan, and photos described).
  canSearch?: boolean;
  // The studio's gallery layout from the Page Designer.
  layout?: GalleryLayout;
  token: string;
  // The photographer's "Preview as client": downloads work but aren't recorded.
  preview?: boolean;
  tiles: FinalTile[];
  studio: string;
  clientFirstName: string | null;
  totalSize: string;
  // The studio's shop (lib/store), when it's open.
  store?: Storefront | null;
  // Back from a paid store checkout: the order number.
  ordered?: string | null;
  orderCancelled?: boolean;
  // The slideshow (Pro and Studio, when the studio left it on), with its song.
  slideshow?: { songUrl: string | null } | null;
  title?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // Gallery search results (null = show everything).
  const [found, setFound] = useState<Set<string> | null>(null);
  const shown = found ? tiles.filter((tile) => found.has(tile.id)) : tiles;
  const cart = useCart(token);
  const [ordering, setOrdering] = useState<FinalTile | null>(null);
  const [added, setAdded] = useState(false);
  // A paid order: the cart's job is done.
  const { clear } = cart;
  useEffect(() => {
    if (ordered) clear();
    // Only when arriving back from checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-bold">
            Your final photos are ready{clientFirstName ? `, ${clientFirstName}` : ""}!
          </p>
          <p className="mt-1 text-muted">
            {tiles.length} {tiles.length === 1 ? "photo" : "photos"} from {studio}, full resolution and ready to keep.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slideshow && tiles.length > 1 && (
            <button type="button" onClick={() => setPlaying(true)} className="btn-secondary">
              ▶ Slideshow
            </button>
          )}
          <a href={`/g/${token}/download${preview ? "?preview=1" : ""}`} className="btn-primary">
            <DownloadIcon size={18} /> Download all · {totalSize}
          </a>
        </div>
      </div>

      {ordered && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Thank you! Your order {ordered} is in. {studio} will email you when it ships.
        </p>
      )}
      {orderCancelled && (
        <p className="mt-6 rounded-2xl bg-sun/30 px-5 py-4 font-semibold">
          Checkout was cancelled, so you weren&rsquo;t charged. Your cart is still here.
        </p>
      )}
      {store && !ordered && (
        <p className="mt-6 rounded-2xl bg-sky-light/50 px-5 py-4 text-sm">
          <strong>Prints and more:</strong> tap 🛍️ on any photo to order {store.products.map((p) => p.name.toLowerCase()).join(", ")} from {studio}.
        </p>
      )}
      {added && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-3 text-sm font-semibold">Added to your cart. Keep shopping or open the cart to check out.</p>
      )}

      {canSearch && (
        <div className="mt-6">
          <SearchBox token={token} onResults={(ids) => setFound(ids ? new Set(ids) : null)} />
        </div>
      )}

      <ul className={`mt-8 ${galleryListClass(layout)}`}>
        {shown.map((tile) => (
          <li key={tile.id} className={galleryItemClass(layout)}>
            <div className="group relative overflow-hidden rounded-2xl bg-brand-deep">
              <button
                type="button"
                onClick={() => setOpen(tiles.indexOf(tile))}
                className="block w-full"
                style={{ aspectRatio: galleryTileAspect(layout, tile.aspect) }}
                aria-label={`View photo ${tile.number}`}
              >
                {/* Signed links to pre-sized versions; next/image optimization isn't needed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.thumbUrl}
                  alt={`Photo ${tile.number}`}
                  loading="lazy"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              </button>
              <span className="pointer-events-none absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-brand-deep/80 text-xs font-bold text-white">
                {tile.number}
              </span>
              {store && (
                <button
                  type="button"
                  onClick={() => {
                    setAdded(false);
                    setOrdering(tile);
                  }}
                  aria-label={`Order prints of photo ${tile.number}`}
                  className="absolute right-15 bottom-2 grid size-11 place-items-center rounded-full bg-white/90 text-lg shadow-lg transition hover:scale-110 hover:bg-lime"
                >
                  🛍️
                </button>
              )}
              <a
                href={tile.downloadUrl}
                aria-label={`Download photo ${tile.number}`}
                className="absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-white/90 text-brand-deep shadow-lg transition hover:scale-110 hover:bg-lime hover:text-on-accent"
              >
                <DownloadIcon size={20} />
              </a>
            </div>
          </li>
        ))}
      </ul>

      {store && ordering && (
        <ShopDialog
          token={token}
          photos={tiles}
          photo={ordering}
          store={store}
          onClose={() => setOrdering(null)}
          onAdd={(item) => {
            cart.add(item);
            setOrdering(null);
            setAdded(true);
          }}
        />
      )}
      {store && <CartPanel token={token} store={store} photos={tiles} cart={cart} preview={preview} />}

      {slideshow && playing && (
        <Slideshow
          photos={tiles.map((tile) => ({ id: tile.id, url: tile.previewUrl }))}
          songUrl={slideshow.songUrl}
          title={title}
          onClose={() => setPlaying(false)}
        />
      )}

      {open !== null && (
        <Lightbox
          items={tiles.map((tile) => ({
            id: tile.id,
            number: tile.number,
            url: tile.previewUrl,
            downloadUrl: tile.downloadUrl,
          }))}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
