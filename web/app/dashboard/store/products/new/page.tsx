import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionTypes } from "@/db/schema";
import { requirePhotographer } from "@/lib/session";
import { addProduct } from "../../actions";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const user = await requirePhotographer();
  const sessions = await db
    .select({ id: sessionTypes.id, name: sessionTypes.name })
    .from(sessionTypes)
    .where(eq(sessionTypes.photographerId, user.id))
    .orderBy(asc(sessionTypes.name));
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Store</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">New product</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <ProductForm action={addProduct} sessions={sessions} submitLabel="Add product" />
      </div>
    </div>
  );
}
