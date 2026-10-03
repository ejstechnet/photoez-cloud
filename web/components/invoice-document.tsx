import { formatPrice } from "@/lib/booking/format";
import { formatDay, formatTaxRate, lineTotal, scheduleRows, statusLabel, isOverdue, type InvoiceKind, type InvoiceStatus, type LineItem, type ScheduledPayment } from "@/lib/invoices/math";

// A quote or invoice laid out like a document, for the client's page, the
// studio's dashboard, and printing / saving as a PDF.

type DocInvoice = {
  kind: InvoiceKind;
  status: InvoiceStatus;
  number: string;
  title: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  eventDate: string | null;
  items: LineItem[];
  taxBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  schedule: ScheduledPayment[];
  paidCents: number;
  notes: string | null;
  terms: string | null;
  createdAt: Date;
};

const STATE_LABELS = { paid: "Paid", partly_paid: "Partly paid", due: "Due", overdue: "Overdue", upcoming: "Upcoming" } as const;
const STATE_STYLES = {
  paid: "bg-lime/20 text-lime-ink",
  partly_paid: "bg-sun/30 text-foreground",
  due: "bg-sky/20 text-foreground",
  overdue: "bg-danger/10 text-danger",
  upcoming: "bg-border text-muted",
} as const;

export function InvoiceStatusBadge({ kind, status, overdue }: { kind: InvoiceKind; status: InvoiceStatus; overdue: boolean }) {
  const style = overdue
    ? "bg-danger/10 text-danger"
    : status === "paid"
      ? "bg-lime/20 text-lime-ink"
      : status === "approved" || status === "partial"
        ? "bg-sky/20 text-foreground"
        : status === "sent"
          ? "bg-sun/30 text-foreground"
          : status === "draft"
            ? "bg-border text-muted"
            : "bg-danger/10 text-danger";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase ${style}`}>
      {statusLabel(kind, status, overdue)}
    </span>
  );
}

export function InvoiceDocument({ invoice, studio, today }: { invoice: DocInvoice; studio: { name: string; email: string }; today: string }) {
  const rows = scheduleRows(invoice.schedule, invoice.paidCents, today);
  const balance = Math.max(0, invoice.totalCents - invoice.paidCents);
  const overdue = isOverdue(invoice.schedule, invoice.paidCents, invoice.status, today);
  const live = invoice.status !== "cancelled" && invoice.status !== "declined";

  return (
    <article className="card p-6 sm:p-10 print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold tracking-wider text-coral uppercase">{invoice.kind === "quote" ? "Quote" : "Invoice"}</p>
          <h2 className="mt-1 font-display text-3xl font-bold">{invoice.title}</h2>
          <p className="mt-1 font-mono text-sm text-muted">{invoice.number}</p>
        </div>
        <div className="sm:text-right">
          <InvoiceStatusBadge kind={invoice.kind} status={invoice.status} overdue={overdue} />
          <p className="mt-2 text-sm text-muted">
            Issued {invoice.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">From</p>
          <p className="mt-1 font-semibold">{studio.name}</p>
          <p className="text-muted">{studio.email}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-muted uppercase">For</p>
          <p className="mt-1 font-semibold">{invoice.clientName}</p>
          <p className="break-all text-muted">{invoice.clientEmail}</p>
          {invoice.clientPhone && <p className="text-muted">{invoice.clientPhone}</p>}
        </div>
        {invoice.eventDate && (
          <div>
            <p className="text-xs font-bold tracking-wider text-muted uppercase">Date</p>
            <p className="mt-1 font-semibold">{formatDay(invoice.eventDate)}</p>
          </div>
        )}
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-border text-left text-xs font-bold tracking-wider text-muted uppercase">
            <th className="py-2 pr-3 font-bold">Description</th>
            <th className="hidden py-2 pr-3 text-right font-bold sm:table-cell">Qty</th>
            <th className="hidden py-2 pr-3 text-right font-bold sm:table-cell">Price</th>
            <th className="py-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} className="border-b border-border align-top">
              <td className="py-3 pr-3">
                {item.description}
                {item.quantity !== 1 && (
                  <span className="block text-xs text-muted sm:hidden">
                    {item.quantity} × {formatPrice(item.unitCents)}
                  </span>
                )}
              </td>
              <td className="hidden py-3 pr-3 text-right tabular-nums sm:table-cell">{item.quantity}</td>
              <td className="hidden py-3 pr-3 text-right tabular-nums sm:table-cell">{formatPrice(item.unitCents)}</td>
              <td className="py-3 text-right font-semibold tabular-nums">{formatPrice(lineTotal(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="tabular-nums">{formatPrice(invoice.subtotalCents)}</dd>
        </div>
        {invoice.taxBps > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted">Tax ({formatTaxRate(invoice.taxBps)})</dt>
            <dd className="tabular-nums">{formatPrice(invoice.taxCents)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-border pt-2 font-display text-xl font-bold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrice(invoice.totalCents)}</dd>
        </div>
        {invoice.paidCents > 0 && (
          <>
            <div className="flex justify-between text-lime-ink">
              <dt>Paid</dt>
              <dd className="tabular-nums">−{formatPrice(invoice.paidCents)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Balance</dt>
              <dd className="tabular-nums">{formatPrice(balance)}</dd>
            </div>
          </>
        )}
      </dl>

      {rows.length > 1 && live && (
        <section className="mt-8">
          <h3 className="text-xs font-bold tracking-wider text-muted uppercase">Payment schedule</h3>
          <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
            {rows.map((row, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{row.label}</span>
                  <span className="block text-xs text-muted">
                    {row.dueDate ? `Due ${formatDay(row.dueDate)}` : invoice.kind === "quote" ? "Due when approved" : "Due now"}
                  </span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${STATE_STYLES[row.state]}`}>
                  {STATE_LABELS[row.state]}
                </span>
                <span className="w-24 text-right font-semibold tabular-nums">{formatPrice(row.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.notes && (
        <section className="mt-8">
          <h3 className="text-xs font-bold tracking-wider text-muted uppercase">Notes</h3>
          <p className="mt-2 text-sm whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}
      {invoice.terms && (
        <section className="mt-6">
          <h3 className="text-xs font-bold tracking-wider text-muted uppercase">Terms</h3>
          <p className="mt-2 text-sm whitespace-pre-line text-muted">{invoice.terms}</p>
        </section>
      )}
    </article>
  );
}
