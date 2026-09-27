import type { Design } from "./design.ts";

// The client gallery layouts from the Page Designer:
// masonry — every photo uncropped in its own shape (PhotoEZ's proofing look),
// grid    — even squares, neatly lined up,
// large   — two big columns, for letting each photo breathe.
export type GalleryLayout = Design["galleryLayout"];

export function galleryListClass(layout: GalleryLayout) {
  if (layout === "grid") return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  if (layout === "large") return "columns-1 gap-5 sm:columns-2";
  return "columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5";
}

export function galleryItemClass(layout: GalleryLayout) {
  if (layout === "grid") return "";
  return layout === "large" ? "mb-5 break-inside-avoid" : "mb-3 break-inside-avoid";
}

// The tile's shape: square in the grid, the photo's own shape otherwise.
export function galleryTileAspect(layout: GalleryLayout, aspect: number) {
  return layout === "grid" ? 1 : aspect;
}
