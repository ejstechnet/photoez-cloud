import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, photographers } from "@/db/schema";
import { InvoiceStatusBadge } from "@/components/invoice-document";
import { formatPrice } from "@/lib/booking/format";
import { formatDay, formatTaxRate, isOverdue } from "@/lib/invoices/math";
import { invoicesAllowed, studioToday } from "@/lib/invoices/server";
import { PLAN_LABELS, planFor } from "@/lib/plans";
import { requirePhotographer } from "@/lib/session";
import { DefaultsForm } from "./defaults-form";

export const metadata = { title: "Quotes & invoices · PhotoEZ Cloud" };

const FILTERS = { all: "All", quote: "Quotes", invoice: "Invoices", open: "Unpaid", overdue: "Overdue" } as const;
type Filter = keyof typeof FILTERS;

// Every quote and invoice, like InvoiceEZ's list: what's owed, what's
// overdue, and what's waiting on a client. Pro and Studio.
export default async function InvoicesPage({ searchParams }: PageProps<"/dashboard/invoices">) {
  const user = await requirePhotographer();
  const show = String((await searchParams).show ?? "all");
  const filter: Filter = show in FILTERS ? (show as Filter) : "all";
  const [studio] = await db
    .select({
      timeZone: photographers.timeZone,
      stripeReady: photographers.stripeChargesEnabled,
      taxBps: photographers.invoiceTaxBps,
      depositPercent: photographers.invoiceDepositPercent,
      terms: photographers.invoiceTerms,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const allowed = await invoicesAllowed(user.id);

  if (!allowed) {
    return (
      <div>
        <Heading />
        <div className="card mt-8 p-8 text-center">
          <p className="font-display text-2xl font-bold">Quotes &amp; invoices are on the {PLAN_LABELS[planFor("invoices")]} plan and up.</p>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Send quotes clients approve online, invoices they pay by card, deposits and payment plans with automatic reminders, and a contract to
            sign before they pay.
          </p>
          <Link href="/dashboard/billing" className="btn-primary mt-5">
            See plans
          </Link>
        </div>
      </div>
    );
  }

  const today = studioToday(studio.timeZone);
  const all = (
    await db.select().from(invoices).where(eq(invoices.photographerId, user.id)).orderBy(desc(invoices.createdAt)).limit(500)
  ).map((i) => ({ ...i, overdue: isOverdue(i.schedule, i.paidCents, i.status, today) }));
  // Owed: a sent invoice, an approved quote, or anything partly paid.
  const open = (i: (typeof all)[number]) => i.status === "partial" || i.status === "approved" || (i.status === "sent" && i.kind === "invoice");
  const shown = all.filter((i) =>
    filter === "all" ? true : filter === "overdue" ? i.overdue : filter === "open" ? open(i) : i.kind === filter,
  );
  const outstanding = all.filter(open).reduce((sum, i) => sum + Math.max(0, i.totalCents - i.paidCents), 0);
  const overdueCents = all.filter((i) => i.overdue).reduce((sum, i) => sum + Math.max(0, i.totalCents - i.paidCents), 0);
  const awaiting = all.filter((i) => i.kind === "quote" && i.status === "sent").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading />
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/invoices/new?kind=quote" className="btn-secondary">
            New quote
          </Link>
          <Link href="/dashboard/invoices/new?kind=invoice" className="btn-primary">
            New invoice
          </Link>
        </div>
      </div>

      {!studio.stripeReady && (
        <p className="mt-4 rounded-2xl bg-sun/30 px-5 py-4 font-medium">
          Connect Stripe in{" "}
          <Link href="/dashboard/settings#payments" className="link">
            Settings
          </Link>{" "}
          so clients can pay online. Until then you can still send quotes and invoices, and record payments yourself.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card border-b-4 border-b-lime p-5">
          <p className="font-display text-3xl font-bold">{formatPrice(outstanding)}</p>
          <p className="text-sm font-semibold text-muted">Still owed</p>
        </div>
        <div className="card border-b-4 border-b-coral p-5">
          <p className="font-display text-3xl font-bold">{formatPrice(overdueCents)}</p>
          <p className="text-sm font-semibold text-muted">Overdue</p>
        </div>
        <div className="card border-b-4 border-b-violet p-5">
          <p className="font-display text-3xl font-bold">{awaiting}</p>
          <p className="text-sm font-semibold text-muted">Quotes awaiting approval</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/dashboard/invoices" : `/dashboard/invoices?show=${f}`}
            className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase transition ${
              filter === f ? "bg-brand text-white" : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {FILTERS[f]}
          </Link>
        ))}
      </nav>

      <div className="mt-4 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          {shown.length === 0 ? (
            <p className="p-8 text-center text-muted">
              {all.length === 0 ? "No quotes or invoices yet. Start one with the buttons above." : "Nothing here."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((i) => (
                <li key={i.id}>
                  <Link href={`/dashboard/invoices/${i.id}`} className="flex flex-col gap-2 p-5 transition hover:bg-background sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-muted">{i.number}</span>
                        <InvoiceStatusBadge kind={i.kind} status={i.status} overdue={i.overdue} />
                      </p>
                      <p className="mt-1 truncate font-semibold">
                        {i.clientName} <span className="font-normal text-muted">· {i.title}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {i.dueDate ? `Due ${formatDay(i.dueDate, "short")}` : i.eventDate ? `Event ${formatDay(i.eventDate, "short")}` : "No due date"}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="font-display text-xl font-bold">{formatPrice(i.totalCents)}</p>
                      {i.paidCents > 0 && i.status !== "paid" && (
                        <p className="text-xs text-muted">{formatPrice(i.totalCents - i.paidCents)} left</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-display text-xl font-bold">Defaults</h2>
          <p className="mt-1 text-sm text-muted">What new quotes and invoices start with. You can change them on each one.</p>
          <div className="mt-5">
            <DefaultsForm taxRate={studio.taxBps ? formatTaxRate(studio.taxBps).replace("%", "") : ""} depositPercent={String(studio.depositPercent)} terms={studio.terms ?? ""} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Get paid</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Quotes &amp; invoices</h1>
    </div>
  );
}
