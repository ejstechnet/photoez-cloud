import { formatPrice } from "../booking/format.ts";
import type { EmailContent } from "./layout.ts";
import { firstName } from "./messages.ts";

// The wording of the quote and invoice emails (InvoiceEZ's emails): sending
// one, reminders, payments, and the studio's notices. Pure functions of
// already-formatted facts; lib/invoices/notify.ts sends them.

export type InvoiceFacts = {
  studioName: string;
  kind: "quote" | "invoice";
  number: string;
  title: string;
  clientName: string;
  totalCents: number;
  paidCents: number;
  // e.g. "Saturday, November 14, 2026"; null when there's no event date.
  eventDate: string | null;
  url: string;
  // The client still needs to sign the contract.
  needsSignature: boolean;
};

const word = (f: InvoiceFacts) => (f.kind === "quote" ? "quote" : "invoice");

function details(f: InvoiceFacts): [string, string][] {
  const rows: [string, string][] = [
    [f.kind === "quote" ? "Quote" : "Invoice", `${f.number} · ${f.title}`],
  ];
  if (f.eventDate) rows.push(["Date", f.eventDate]);
  rows.push(["Total", formatPrice(f.totalCents)]);
  if (f.paidCents > 0) {
    rows.push(["Paid", formatPrice(f.paidCents)]);
    rows.push(["Balance", formatPrice(Math.max(0, f.totalCents - f.paidCents))]);
  }
  return rows;
}

// The quote or invoice itself, with the studio's optional note.
export function invoiceSentClient(f: InvoiceFacts, o: { message: string | null; next: { label: string; amountCents: number; due: string | null } | null }): EmailContent {
  const intro = [
    f.kind === "quote"
      ? `Hi ${firstName(f.clientName)}, ${f.studioName} sent you a quote. You can look it over and approve it online.`
      : `Hi ${firstName(f.clientName)}, ${f.studioName} sent you an invoice. You can view it and pay online.`,
  ];
  if (o.message) intro.push(o.message);
  const rows = details(f);
  if (f.kind === "invoice" && o.next) rows.push([o.next.label, `${formatPrice(o.next.amountCents)}${o.next.due ? `, due ${o.next.due}` : ", due now"}`]);
  return {
    subject: f.kind === "quote" ? `Your quote from ${f.studioName}: ${f.title}` : `Invoice ${f.number} from ${f.studioName}`,
    heading: f.kind === "quote" ? "Your quote is ready" : "Your invoice",
    intro,
    details: rows,
    button: { label: f.kind === "quote" ? "View & approve quote" : "View & pay invoice", url: f.url },
    outro: [`Questions? Reply to this email to reach ${f.studioName}.`],
  };
}

// A quote still waiting on the client a few days after it was sent.
export function quoteReminderClient(f: InvoiceFacts): EmailContent {
  return {
    subject: `Reminder: your quote from ${f.studioName}`,
    heading: "Your quote is waiting",
    intro: [`Hi ${firstName(f.clientName)}, just a friendly reminder that your quote from ${f.studioName} is ready for you to review.`],
    details: details(f),
    button: { label: "View quote", url: f.url },
    outro: [`Questions or changes? Reply to this email to reach ${f.studioName}.`],
  };
}

// A scheduled payment coming up (InvoiceEZ: 3 days before it's due).
export function paymentReminderClient(f: InvoiceFacts, p: { label: string; amountCents: number; due: string }): EmailContent {
  return {
    subject: `${p.label} of ${formatPrice(p.amountCents)} is due ${p.due}`,
    heading: "Payment coming up",
    intro: [`Hi ${firstName(f.clientName)}, this is a friendly reminder that your next payment to ${f.studioName} is due ${p.due}.`],
    details: [...details(f), [p.label, formatPrice(p.amountCents)]],
    button: { label: `Pay ${formatPrice(p.amountCents)}`, url: f.url },
    outro: [`Already paid another way? Reply to this email to let ${f.studioName} know.`],
  };
}

export function paymentOverdueClient(f: InvoiceFacts, p: { label: string; amountCents: number; due: string }): EmailContent {
  return {
    subject: `Past due: ${p.label.toLowerCase()} for ${f.studioName}`,
    heading: "Payment past due",
    intro: [
      `Hi ${firstName(f.clientName)}, your payment of ${formatPrice(p.amountCents)} to ${f.studioName} was due ${p.due}. You can pay it online any time.`,
    ],
    details: [...details(f), [p.label, formatPrice(p.amountCents)]],
    button: { label: `Pay ${formatPrice(p.amountCents)}`, url: f.url },
    outro: [`Already paid, or need to talk it over? Reply to this email to reach ${f.studioName}.`],
  };
}

// The client's receipt.
export function invoicePaymentClient(f: InvoiceFacts, amountCents: number): EmailContent {
  const balance = Math.max(0, f.totalCents - f.paidCents);
  return {
    subject: `Payment received: ${formatPrice(amountCents)} to ${f.studioName}`,
    heading: "Thank you for your payment",
    intro: [
      `Hi ${firstName(f.clientName)}, we received your payment of ${formatPrice(amountCents)} for ${f.title}.`,
      balance > 0 ? `Your remaining balance is ${formatPrice(balance)}.` : `Your ${word(f)} is paid in full. Thank you!`,
    ],
    details: details(f),
    button: { label: `View ${word(f)}`, url: f.url },
  };
}

// Notices to the studio: approved, declined, contract signed, payment.
export function invoiceUpdateStudio(
  f: InvoiceFacts & { dashboardUrl: string },
  what: { type: "approved" } | { type: "declined"; reason: string | null } | { type: "signed"; signerName: string } | { type: "paid"; amountCents: number },
): EmailContent {
  const who = f.clientName;
  const by = {
    approved: { subject: `${who} approved quote ${f.number}`, heading: "Quote approved 🎉", line: `${who} approved your quote for ${f.title}.` },
    declined: { subject: `${who} declined quote ${f.number}`, heading: "Quote declined", line: `${who} declined your quote for ${f.title}.` },
    signed: { subject: `${who} signed the contract for ${f.number}`, heading: "Contract signed", line: "" },
    paid: { subject: `Payment received from ${who} (${f.number})`, heading: "Payment received", line: "" },
  }[what.type];
  const intro = [by.line];
  if (what.type === "declined" && what.reason) intro.push(`Their note: ${what.reason}`);
  if (what.type === "signed") intro[0] = `${what.signerName} signed the contract for ${f.title}.`;
  if (what.type === "paid") intro[0] = `${who} paid ${formatPrice(what.amountCents)} toward ${f.title}.`;
  if (what.type === "approved" && f.needsSignature) intro.push("They'll sign the contract next, then pay.");
  return { subject: by.subject, heading: by.heading, intro, details: details(f), button: { label: `Open ${word(f)}`, url: f.dashboardUrl } };
}
