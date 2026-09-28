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
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Store</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{product.name}</h1>
      {added === "1" && (
        <p className="mt-6 rounded-2xl bg-lime/20 px-5 py-4 font-semibold">
          Product added! Now add a picture or two so clients can see what they&rsquo;re ordering.
        </p>
      )}
      <div className="card mt-8 p-6 sm:p-8">
        <ProductPhotos
          productId={product.id}
          photos={await Promise.all(product.imageKeys.map(async (key) => ({ key, url: await signedViewUrl(key) })))}
        />
      </div>
      <div className="card mt-6 p-6 sm:p-8">
        <ProductForm action={updateProduct.bind(null, product.id)} defaultValues={product} submitLabel="Save changes" />
      </div>
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
