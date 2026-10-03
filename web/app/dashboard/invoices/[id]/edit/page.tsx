import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { formatTaxRate } from "@/lib/invoices/math";
import { requirePhotographer } from "@/lib/session";
import type { EditorInput } from "../../actions";
import { InvoiceEditor } from "../../editor";
import { editorChoices } from "../../editor-data";

export const metadata = { title: "Edit · PhotoEZ Cloud" };

// Changing a quote or invoice before the client has answered, signed, or paid.
export default async function EditInvoicePage({ params }: PageProps<"/dashboard/invoices/[id]/edit">) {
  const { id } = await params;
  const user = await requirePhotographer();
  if (!z.uuid().safeParse(id).success) notFound();
  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.photographerId, user.id)));
  if (!invoice) notFound();
  if (!((invoice.status === "draft" || invoice.status === "sent") && invoice.paidCents === 0 && !invoice.signedAt)) {
    redirect(`/dashboard/invoices/${invoice.id}`);
  }
  const choices = await editorChoices(user.id);
  const plan = invoice.plan;

  const initial: EditorInput = {
    id: invoice.id,
    kind: invoice.kind,
    clientId: invoice.clientId,
    inquiryId: invoice.inquiryId,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientPhone: invoice.clientPhone ?? "",
    title: invoice.title,
    eventDate: invoice.eventDate ?? "",
    items: invoice.items.map((item) => ({ description: item.description, quantity: String(item.quantity), price: (item.unitCents / 100).toFixed(2) })),
    taxRate: invoice.taxBps ? formatTaxRate(invoice.taxBps).replace("%", "") : "",
    plan: {
      mode: plan.mode,
      depositPercent: plan.mode === "full" ? 50 : plan.depositPercent,
      count: plan.mode === "installments" ? plan.count : 3,
      every: plan.mode === "installments" ? plan.every : "month",
      firstDue: plan.mode === "installments" ? plan.firstDue : "",
    },
    dueDate: plan.mode === "installments" ? "" : (invoice.dueDate ?? ""),
    contractTemplateId: invoice.contractTemplateId,
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
  };

  return (
    <div>
      <Link href={`/dashboard/invoices/${invoice.id}`} className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← {invoice.number}
      </Link>
      <h1 className="mt-2 mb-6 font-display text-4xl font-bold tracking-tight">Edit {invoice.kind}</h1>
      {invoice.status === "sent" && (
        <p className="mb-6 rounded-2xl bg-sun/30 px-5 py-4 font-medium">
          This was already sent. The client&apos;s link shows your changes right away; use &ldquo;Save &amp; send&rdquo; to email them again.
        </p>
      )}
      <InvoiceEditor initial={initial} clients={choices.clients} templates={choices.templates} />
    </div>
  );
}
