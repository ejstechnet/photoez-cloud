import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { photographers, storeProducts } from "@/db/schema";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { isSwaggPressKey, swaggCatalog, SwaggPressError, type SwaggCatalog } from "./client";
import { swaggDesign, swaggImages, swaggVariants, syncSwaggVariants } from "./mapping";

// A studio's SwaggPress connection and the products it added from the
// SwaggPress catalog. Wholesale prices, sizes, and photos follow SwaggPress
// (syncSwaggProducts); the studio's own retail prices stay theirs.

const variantId = () => randomBytes(5).toString("hex");
const SYNC_EVERY_MS = 6 * 60 * 60 * 1000;

export async function swaggKeyFor(photographerId: string) {
  const [studio] = await db
    .select({ key: photographers.swaggpressKey })
    .from(photographers)
    .where(eq(photographers.id, photographerId));
  return studio?.key ? openSecret(studio.key) : null;
}

// Checks the key with SwaggPress, then keeps it (sealed).
export async function connectSwaggPress(photographerId: string, key: string): Promise<{ ok: true; business: string } | { error: string }> {
  const clean = key.trim();
  if (!isSwaggPressKey(clean)) return { error: "That doesn't look like a SwaggPress API key. It starts with spk_." };
  let catalog: SwaggCatalog;
  try {
    catalog = await swaggCatalog(clean);
  } catch (error) {
    return { error: error instanceof SwaggPressError && error.status === 401 ? "SwaggPress didn't accept that key. Check it, or make a new one at swaggpress.com." : (error as Error).message };
  }
  await db
    .update(photographers)
    .set({
      swaggpressKey: sealSecret(clean),
      swaggpressBusiness: catalog.partner.business_name,
      swaggpressCardOnFile: catalog.partner.card_on_file,
      swaggpressSyncedAt: new Date(),
    })
    .where(eq(photographers.id, photographerId));
  await syncSwaggProducts(photographerId, catalog);
  return { ok: true, business: catalog.partner.business_name };
}

export async function disconnectSwaggPress(photographerId: string) {
  await db
    .update(photographers)
    .set({ swaggpressKey: null, swaggpressBusiness: null, swaggpressCardOnFile: false, swaggpressSyncedAt: null })
    .where(eq(photographers.id, photographerId));
}

// The live catalog, for browsing (null when not connected).
export async function swaggCatalogFor(photographerId: string) {
  const key = await swaggKeyFor(photographerId);
  return key ? swaggCatalog(key) : null;
}

export async function addSwaggProduct(photographerId: string, labProductId: number): Promise<{ id: string } | { error: string }> {
  const catalog = await swaggCatalogFor(photographerId);
  if (!catalog) return { error: "Connect SwaggPress first." };
  const product = catalog.products.find((p) => p.id === labProductId);
  if (!product) return { error: "SwaggPress doesn't offer that product right now." };
  const [already] = await db
    .select({ id: storeProducts.id })
    .from(storeProducts)
    .where(and(eq(storeProducts.photographerId, photographerId), eq(storeProducts.labProductId, labProductId)));
  if (already) return { id: already.id };
  const [{ n }] = await db.select({ n: count() }).from(storeProducts).where(eq(storeProducts.photographerId, photographerId));
  const variants = swaggVariants(product, variantId);
  const [created] = await db
    .insert(storeProducts)
    .values({
      photographerId,
      name: product.name,
      description: product.description ? product.description.slice(0, 200) : null,
      cropToSize: variants.some((v) => v.widthIn !== null),
      variants,
      fulfillment: "swaggpress",
      labProductId,
      labImageUrls: swaggImages(product),
      labDesign: swaggDesign(product),
      sortOrder: n,
    })
    .returning({ id: storeProducts.id });
  return { id: created.id };
}

// Brings added SwaggPress products up to date with the catalog. Pass a
// catalog already fetched, or it's fetched here (at most every 6 hours
// unless forced). Returns an error message when SwaggPress couldn't be read.
export async function syncSwaggProducts(photographerId: string, catalog?: SwaggCatalog, force = false): Promise<string | null> {
  if (!catalog) {
    const [studio] = await db
      .select({ key: photographers.swaggpressKey, syncedAt: photographers.swaggpressSyncedAt })
      .from(photographers)
      .where(eq(photographers.id, photographerId));
    if (!studio?.key) return "SwaggPress isn't connected.";
    if (!force && studio.syncedAt && Date.now() - studio.syncedAt.getTime() < SYNC_EVERY_MS) return null;
    const key = openSecret(studio.key);
    if (!key) return "The saved SwaggPress key can't be read. Disconnect and connect again.";
    try {
      catalog = await swaggCatalog(key);
    } catch (error) {
      console.error("SwaggPress sync failed", error);
      return (error as Error).message;
    }
    await db
      .update(photographers)
      .set({ swaggpressCardOnFile: catalog.partner.card_on_file, swaggpressBusiness: catalog.partner.business_name, swaggpressSyncedAt: new Date() })
      .where(eq(photographers.id, photographerId));
  }
  const mine = await db
    .select()
    .from(storeProducts)
    .where(and(eq(storeProducts.photographerId, photographerId), eq(storeProducts.fulfillment, "swaggpress")));
  for (const product of mine) {
    const lab = catalog.products.find((p) => p.id === product.labProductId) ?? null;
    const variants = syncSwaggVariants(product.variants, lab, variantId);
    await db
      .update(storeProducts)
      .set({
        variants,
        labUnavailable: !lab,
        ...(lab
          ? { labImageUrls: swaggImages(lab), labDesign: swaggDesign(lab), cropToSize: variants.some((v) => v.widthIn !== null) }
          : {}),
      })
      .where(eq(storeProducts.id, product.id));
  }
  return null;
}
