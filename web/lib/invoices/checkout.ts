import { db } from "@/db";
import { payments } from "@/db/schema";
import { paymentAccount } from "@/lib/payments/checkout";
import { siteUrl } from "@/lib/site";
import { stripe } from "@/lib/stripe";
import { amountToPay, type Invoice } from "./server";

// Stripe Checkout for a quote or invoice, on the studio's own connected
// account, like booking payments. The client pays the next scheduled payment
// or the whole balance; applyCheckoutSession (lib/payments/checkout.ts)
// records it once Stripe confirms.
export async function startInvoiceCheckout(invoice: Invoice, studioName: string, which: "next" | "full") {
  const account = await paymentAccount(invoice.photographerId);
  if (!account) return null;
  const pay = amountToPay(invoice, which);
  if (!pay) return null;

  const base = `${siteUrl}/i/${invoice.token}/pay`;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: invoice.clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pay.amountCents,
            product_data: {
              name: `${invoice.title} · ${pay.label}`,
              description: `${studioName} · ${invoice.number}`,
            },
          },
        },
      ],
      metadata: { invoiceId: invoice.id, kind: "invoice" },
      payment_intent_data: { metadata: { invoiceId: invoice.id, kind: "invoice" } },
      success_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/return?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
    },
    { stripeContext: account },
  );

  await db.insert(payments).values({
    invoiceId: invoice.id,
    kind: "invoice",
    amountCents: pay.amountCents,
    stripeAccountId: account,
    stripeCheckoutSessionId: session.id,
  });
  return session.url;
}
