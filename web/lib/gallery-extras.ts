// Extra photo selections beyond what a gallery includes (PhotoEZ's paid
// extras). Pure logic, tested in gallery-extras.test.ts.

// The price per extra photo when extras are on for a gallery, or null when
// the client is simply capped at the included number: the photographer's plan
// must include upsells, and a gallery with no limit has nothing extra to sell.
export function extraPhotoPrice(options: {
  planAllows: boolean;
  freeLimit: number;
  galleryPriceCents: number | null;
  studioPriceCents: number;
}): number | null {
  if (!options.planAllows || options.freeLimit === 0) return null;
  const price = options.galleryPriceCents ?? options.studioPriceCents;
  return price > 0 ? price : null;
}

// How many selections are extra, and what they cost.
export function extrasFor(selected: number, freeLimit: number, priceCents: number | null) {
  if (priceCents === null || freeLimit === 0) return { count: 0, cents: 0 };
  const count = Math.max(0, selected - freeLimit);
  return { count, cents: count * priceCents };
}
