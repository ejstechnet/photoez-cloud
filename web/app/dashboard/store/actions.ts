"use server";

import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { photographers, storeOrders, storeProducts, type StoreVariant } from "@/db/schema";
import { emailStoreOrderShipped } from "@/lib/email/notify";
import { requirePhotographer } from "@/lib/session";
import { MAX_PRODUCT_PHOTOS, MAX_VARIANTS, STARTER_PRINTS, parsePrice } from "@/lib/store/rules";
import { deletePrefix, signedUploadUrl, storedSize, storeProductPhotoKey } from "@/lib/storage";
import { moveInList } from "@/lib/reorder";

// The photographer's side of the Online Store: settings, products, and
// marking orders shipped.

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const variantId = () => randomBytes(5).toString("hex");

export type StoreSettingsState = { message?: string; saved?: boolean };

// Flat shipping per order and an optional handling fee, in dollars ($0–$500).
function dollars(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(/^\$/, "");
  if (text === "") return 0;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 500 ? Math.round(n * 100) : null;
}

export async function saveStoreSettings(_prev: StoreSettingsState, formData: FormData): Promise<StoreSettingsState> {
  const photographer = await requirePhotographer();
  const shipping = dollars(formData.get("shipping"));
  const handling = dollars(formData.get("handling"));
  if (shipping === null || handling === null) return { message: "Use dollar amounts from $0 to $500." };
  await db
    .update(photographers)
    .set({ storeEnabled: formData.get("enabled") === "on", storeShippingCents: shipping, storeHandlingCents: handling })
    .where(eq(photographers.id, photographer.id));
  revalidatePath("/dashboard/store");
  return { saved: true };
}

export type ProductFormState = { message?: string };

// The product form sends rows of variant.label / .price / .width / .height.
function readVariants(formData: FormData, existing: StoreVariant[]) {
  const labels = formData.getAll("variantLabel").map(String);
  const prices = formData.getAll("variantPrice").map(String);
  const widths = formData.getAll("variantWidth").map(String);
  const heights = formData.getAll("variantHeight").map(String);
  const ids = formData.getAll("variantId").map(String);
  const variants: StoreVariant[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].trim().slice(0, 40);
    if (!label && !prices[i]?.trim()) continue;
    if (!label) return { error: "Give every size a name, like 8×10." };
    const priceCents = parsePrice(prices[i] ?? "");
    if (priceCents === null) return { error: `Enter a price for ${label}, from $0.50 up.` };
    const width = Number(widths[i]);
    const height = Number(heights[i]);
    // Width and height are optional (tees, mugs), but go together.
    const widthText = widths[i]?.trim() ?? "";
    const heightText = heights[i]?.trim() ?? "";
    const hasSize = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width <= 120 && height <= 120;
    if ((widthText || heightText) && !hasSize) {
      return { error: `For ${label}, enter both the width and height in inches (up to 120), or leave both blank.` };
    }
    variants.push({
      // Keep an existing size's id so carts that have it keep working.
      id: existing.some((v) => v.id === ids[i]) ? ids[i] : variantId(),
      label,
      priceCents,
      widthIn: hasSize ? width : null,
      heightIn: hasSize ? height : null,
    });
  }
  if (variants.length === 0) return { error: "Add at least one size or option with a price." };
  if (variants.length > MAX_VARIANTS) return { error: `Up to ${MAX_VARIANTS} sizes per product.` };
  return { variants };
}

async function saveProduct(photographerId: string, productId: string | null, formData: FormData): Promise<ProductFormState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { message: "Give the product a name, like Photo Prints." };
  const description = String(formData.get("description") ?? "").trim().slice(0, 200) || null;
  const [current] = productId
    ? await db
        .select({ variants: storeProducts.variants })
        .from(storeProducts)
        .where(and(eq(storeProducts.id, productId), eq(storeProducts.photographerId, photographerId)))
    : [];
  if (productId && !current) return { message: "That product could not be found." };
  const read = readVariants(formData, current?.variants ?? []);
  if ("error" in read) return { message: read.error };
  // Cropping now follows each size's width and height (lib/store/rules.ts).
  const cropToSize = read.variants.some((v) => v.widthIn !== null);
  const values = { name, description, cropToSize, variants: read.variants, active: formData.get("active") === "on" };
  if (productId) {
    await db.update(storeProducts).set(values).where(eq(storeProducts.id, productId));
    revalidatePath("/dashboard/store");
    redirect("/dashboard/store");
  }
  const [{ n }] = await db.select({ n: count() }).from(storeProducts).where(eq(storeProducts.photographerId, photographerId));
  const [created] = await db
    .insert(storeProducts)
    .values({ ...values, photographerId, sortOrder: n })
    .returning({ id: storeProducts.id });
  revalidatePath("/dashboard/store");
  // On to its page, where pictures of it can be added.
  redirect(`/dashboard/store/products/${created.id}?added=1`);
}

export async function addProduct(_prev: ProductFormState, formData: FormData) {
  const photographer = await requirePhotographer();
  return saveProduct(photographer.id, null, formData);
}

export async function updateProduct(productId: string, _prev: ProductFormState, formData: FormData) {
  const photographer = await requirePhotographer();
  if (!isUuid(productId)) return { message: "That product could not be found." };
  return saveProduct(photographer.id, productId, formData);
}

export async function deleteProduct(productId: string): Promise<void> {
  const photographer = await requirePhotographer();
  if (isUuid(productId)) {
    // Past orders keep their own copy of the product's name and price.
    const [removed] = await db
      .delete(storeProducts)
      .where(and(eq(storeProducts.id, productId), eq(storeProducts.photographerId, photographer.id)))
      .returning({ id: storeProducts.id });
    if (removed) await deletePrefix(`photographers/${photographer.id}/store/${removed.id}/`);
  }
  revalidatePath("/dashboard/store");
  redirect("/dashboard/store");
}

// "Add starter prints": a Photo Prints product with common sizes, to edit.
export async function addStarterPrints(): Promise<void> {
  const photographer = await requirePhotographer();
  const [{ n }] = await db.select({ n: count() }).from(storeProducts).where(eq(storeProducts.photographerId, photographer.id));
  await db.insert(storeProducts).values({
    photographerId: photographer.id,
    name: "Photo Prints",
    description: "Printed on professional photo paper",
    cropToSize: true,
    variants: STARTER_PRINTS.map((v) => ({ ...v, id: variantId() })),
    sortOrder: n,
  });
  revalidatePath("/dashboard/store");
}

// Shipped: saves the carrier and tracking number and emails the client.
export async function markOrderShipped(orderId: string, formData: FormData): Promise<{ message?: string }> {
  const photographer = await requirePhotographer();
  if (!isUuid(orderId)) return { message: "That order could not be found." };
  const carrier = String(formData.get("carrier") ?? "").trim().slice(0, 40) || null;
  const tracking = String(formData.get("tracking") ?? "").trim().slice(0, 80) || null;
  const updated = await db
    .update(storeOrders)
    .set({ status: "shipped", shippedAt: new Date(), carrier, trackingNumber: tracking })
    .where(and(eq(storeOrders.id, orderId), eq(storeOrders.photographerId, photographer.id), eq(storeOrders.status, "paid")))
    .returning({ id: storeOrders.id });
  if (updated.length === 0) return { message: "Only paid orders can be marked shipped." };
  await emailStoreOrderShipped(orderId);
  revalidatePath("/dashboard/store/orders", "layout");
  return {};
}

// ---- Product pictures ----
// Same two steps as other photos: a one-time upload link for a browser-resized
// JPEG, then a save that checks it arrived. Up to MAX_PRODUCT_PHOTOS each.

const MAX_PRODUCT_PHOTO_BYTES = 4 * 1024 * 1024;

async function ownedProduct(photographerId: string, productId: string) {
  if (!isUuid(productId)) return null;
  const [product] = await db
    .select({ id: storeProducts.id, imageKeys: storeProducts.imageKeys })
    .from(storeProducts)
    .where(and(eq(storeProducts.id, productId), eq(storeProducts.photographerId, photographerId)));
  return product ?? null;
}

export async function prepareProductPhotoUpload(
  productId: string,
  size: number,
): Promise<{ version: string; url: string } | { error: string }> {
  const photographer = await requirePhotographer();
  const product = await ownedProduct(photographer.id, productId);
  if (!product) return { error: "That product could not be found." };
  if (product.imageKeys.length >= MAX_PRODUCT_PHOTOS) return { error: `Up to ${MAX_PRODUCT_PHOTOS} pictures per product.` };
  if (size > MAX_PRODUCT_PHOTO_BYTES) return { error: "That picture is too large. Try a smaller one." };
  const version = randomBytes(6).toString("hex");
  return { version, url: await signedUploadUrl(storeProductPhotoKey(photographer.id, productId, version), "image/jpeg") };
}

export async function saveProductPhoto(productId: string, version: string): Promise<{ ok: true } | { error: string }> {
  const photographer = await requirePhotographer();
  const product = await ownedProduct(photographer.id, productId);
  if (!product || !/^[a-f0-9]{12}$/.test(version)) return { error: "That upload couldn't be saved." };
  const key = storeProductPhotoKey(photographer.id, productId, version);
  const size = await storedSize(key);
  if (size === null) return { error: "The picture upload didn't finish. Try again." };
  if (size > MAX_PRODUCT_PHOTO_BYTES || product.imageKeys.length >= MAX_PRODUCT_PHOTOS) {
    await deletePrefix(key);
    return { error: `Up to ${MAX_PRODUCT_PHOTOS} pictures per product, 4 MB each.` };
  }
  await db.update(storeProducts).set({ imageKeys: [...product.imageKeys, key] }).where(eq(storeProducts.id, productId));
  revalidatePath(`/dashboard/store/products/${productId}`);
  return { ok: true };
}

export async function removeProductPhoto(productId: string, key: string): Promise<void> {
  const photographer = await requirePhotographer();
  const product = await ownedProduct(photographer.id, productId);
  if (!product?.imageKeys.includes(key)) return;
  await db
    .update(storeProducts)
    .set({ imageKeys: product.imageKeys.filter((k) => k !== key) })
    .where(eq(storeProducts.id, productId));
  await deletePrefix(key);
  revalidatePath(`/dashboard/store/products/${productId}`);
}

// Moves a picture one place earlier (-1) or later (1); the first is the cover.
export async function moveProductPhoto(productId: string, key: string, by: -1 | 1): Promise<void> {
  const photographer = await requirePhotographer();
  const product = await ownedProduct(photographer.id, productId);
  if (!product) return;
  const order = moveInList(product.imageKeys, key, by);
  if (!order) return;
  await db.update(storeProducts).set({ imageKeys: order }).where(eq(storeProducts.id, productId));
  revalidatePath(`/dashboard/store/products/${productId}`);
}
