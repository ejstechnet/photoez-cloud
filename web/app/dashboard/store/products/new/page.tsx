import type { Metadata } from "next";
import { addProduct } from "../../actions";
import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Store</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">New product</h1>
      <div className="card mt-8 p-6 sm:p-8">
        <ProductForm action={addProduct} submitLabel="Add product" />
      </div>
    </div>
  );
}
