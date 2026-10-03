import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, inquiries, photographers } from "@/db/schema";
import { formatTaxRate } from "@/lib/invoices/math";
import { invoicesAllowed } from "@/lib/invoices/server";
import { requirePhotographer } from "@/lib/session";
import type { EditorInput } from "../actions";
import { InvoiceEditor } from "../editor";
import { editorChoices } from "../editor-data";

export const metadata = { title: "New quote or invoice · PhotoEZ Cloud" };

// A new quote or invoice, optionally for a client (?client=) or from an
// inquiry (?inquiry=), starting from the studio's defaults.
export default async function NewInvoicePage({ searchParams }: PageProps<"/dashboard/invoices/new">) {
  const user = await requirePhotographer();
  if (!(await invoicesAllowed(user.id))) redirect("/dashboard/invoices");
  const params = await searchParams;
  const kind = params.kind === "quote" ? "quote" : "invoice";
  const clientId = z.uuid().safeParse(params.client).data ?? null;
  const inquiryId = z.uuid().safeParse(params.inquiry).data ?? null;

  const [studio] = await db
    .select({ taxBps: photographers.invoiceTaxBps, depositPercent: photographers.invoiceDepositPercent, terms: photographers.invoiceTerms })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const choices = await editorChoices(user.id);

  let client = clientId ? choices.clients.find((c) => c.id === clientId) : undefined;
  let fromInquiry: { id: string; name: string | null; email: string | null } | null = null;
  if (inquiryId) {
    const [inquiry] = await db
      .select({ id: inquiries.id, name: inquiries.fromName, email: inquiries.fromEmail, clientId: inquiries.clientId })
      .from(inquiries)
      .where(and(eq(inquiries.id, inquiryId), eq(inquiries.photographerId, user.id)));
    if (inquiry) {
      fromInquiry = inquiry;
      if (!client && inquiry.clientId) {
        const [c] = await db.select().from(clients).where(eq(clients.id, inquiry.clientId));
        client = c ?? undefined;
      }
    }
  }

  const initial: EditorInput = {
    id: null,
    kind,
    clientId: client?.id ?? null,
    inquiryId: fromInquiry?.id ?? null,
    clientName: client?.name ?? fromInquiry?.name ?? "",
    clientEmail: client?.email ?? fromInquiry?.email ?? "",
    clientPhone: client?.phone ?? "",
    title: "",
    eventDate: "",
    items: [{ description: "", quantity: "1", price: "" }],
    taxRate: studio.taxBps ? formatTaxRate(studio.taxBps).replace("%", "") : "",
    plan: { mode: studio.depositPercent > 0 ? "deposit" : "full", depositPercent: studio.depositPercent, count: 3, every: "month", firstDue: "" },
    dueDate: "",
    contractTemplateId: null,
    notes: "",
    terms: studio.terms ?? "",
  };

  return (
    <div>
      <Link href="/dashboard/invoices" className="text-xs font-bold tracking-wider text-muted uppercase hover:text-foreground">
        ← Quotes &amp; invoices
      </Link>
      <h1 className="mt-2 mb-6 font-display text-4xl font-bold tracking-tight">{kind === "quote" ? "New quote" : "New invoice"}</h1>
      <InvoiceEditor initial={initial} clients={choices.clients} templates={choices.templates} />
    </div>
  );
}
