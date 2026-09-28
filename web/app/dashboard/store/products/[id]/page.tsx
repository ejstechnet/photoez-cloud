import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { storeProducts } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { deleteProduct, updateProduct } from "../../actions";
import { ProductForm } from "../../product-form";
import { ConfirmButton } from "@/app/dashboard/bookings/confirm-button";
import { signedViewUrl } from "@/lib/storage";
import { ProductPhotos } from "../../product-photos";
import { SwaggPricesForm } from "../../swagg-prices-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/dashboard/store/products/[id]">) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();
  const [product] = await db
    .select()
    .from(storeProducts)
    .where(and(eq(storeProducts.id, id), eq(storeProducts.photographerId, user.id)));
  if (!product) notFound();
  const swagg = product.fulfillment === "swaggpress";
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Store</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{product.name}</h1>
      {swagg && (
        <p className="mt-2 text-sm font-semibold text-muted">Printed and shipped by SwaggPress Creations</p>
      )}
      {added === "swaggpress" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Added to your store! Check your prices below. Each starts at about double wholesale.
        </p>
      )}
      {swagg && product.labUnavailable && (
        <p className="mt-6 rounded-2xl bg-sun/30 px-5 py-4 font-semibold">
          SwaggPress no longer offers this product, so it&rsquo;s hidden from your clients. You can delete it.
        </p>
      )}
      {added === "1" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Product added! Now add a picture or two so clients can see what they&rsquo;re ordering.
        </p>
      )}
      {swagg ? (
        <>
          {product.labImageUrls.length > 0 && (
            <div className="mt-8 flex snap-x gap-2 overflow-x-auto pb-1">
              {product.labImageUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`${product.name}, photo ${i + 1}`} className="h-40 w-auto shrink-0 snap-start rounded-2xl bg-white object-contain" />
              ))}
            </div>
          )}
          <div className="card mt-6 p-6 sm:p-8">
            <SwaggPricesForm action={updateProduct.bind(null, product.id)} defaultValues={product} />
          </div>
        </>
      ) : (
        <>
          <div className="card mt-8 p-6 sm:p-8">
            <ProductPhotos
              productId={product.id}
              photos={await Promise.all(product.imageKeys.map(async (key) => ({ key, url: await signedViewUrl(key) })))}
            />
          </div>
          <div className="card mt-6 p-6 sm:p-8">
            <ProductForm action={updateProduct.bind(null, product.id)} defaultValues={product} submitLabel="Save changes" />
          </div>
        </>
      )}
      <div className="mt-8 flex flex-col gap-3 rounded-3xl border-2 border-dashed border-danger/30 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-semibold">Delete this product.</span>{" "}
          <span className="text-muted">Past orders keep their details.</span>
        </p>
        <ConfirmButton action={deleteProduct.bind(null, product.id)} confirmText={`Delete ${product.name}?`} danger>
          Delete product
        </ConfirmButton>
      </div>
    </div>
  );
}
