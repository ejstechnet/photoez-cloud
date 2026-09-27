import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { giftCards, photographers } from "@/db/schema";
import { formatPrice } from "@/lib/booking/format";
import { formatDate } from "@/lib/booking/time";
import { requirePhotographer } from "@/lib/session";
import { ConfirmButton } from "../bookings/confirm-button";
import { resendGiftCard, voidGiftCard } from "./actions";
import { IssueForm } from "./issue-form";

export const metadata = { title: "Gift cards · PhotoEZ Cloud" };

// Every gift card the studio has sold or issued, with what's left on each.
export default async function GiftCardsPage() {
  const user = await requirePhotographer();
  const [studio] = await db
    .select({
      timeZone: photographers.timeZone,
      slug: photographers.studioSlug,
      enabled: photographers.giftCardsEnabled,
      stripeReady: photographers.stripeChargesEnabled,
    })
    .from(photographers)
    .where(eq(photographers.id, user.id));
  const cards = await db
    .select()
    .from(giftCards)
    .where(and(eq(giftCards.photographerId, user.id), ne(giftCards.status, "pending_payment")))
    .orderBy(desc(giftCards.createdAt))
    .limit(300);
  const active = cards.filter((c) => c.status === "active");
  const sold = cards.filter((c) => c.source === "purchased" && c.status !== "void");
  const outstanding = active.reduce((sum, c) => sum + c.balanceCents, 0);

  return (
    <div>
      <p className="text-sm font-bold tracking-wider text-coral uppercase">Give the gift of photos</p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">Gift cards</h1>

      {!studio.enabled ? (
        <p className="mt-4 rounded-2xl bg-sun/30 px-5 py-4 font-medium">
          Gift cards aren&apos;t for sale on your studio page yet. Turn them on in{" "}
          <Link href="/dashboard/settings#gift-cards" className="link">
            Settings
          </Link>
          {studio.stripeReady ? "." : " (they need Stripe connected)."} You can still issue free cards below.
        </p>
      ) : (
        studio.slug && (
          <p className="mt-2 text-muted">
            Clients buy them at{" "}
            <a href={`/studio/${studio.slug}/gift-card`} target="_blank" className="link">
              your gift card page
            </a>
            . Amounts and options are in{" "}
            <Link href="/dashboard/settings#gift-cards" className="link">
              Settings
            </Link>
            .
          </p>
        )
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card border-b-4 border-b-lime p-5">
          <p className="font-display text-3xl font-bold">{formatPrice(sold.reduce((s, c) => s + c.amountCents, 0))}</p>
          <p className="text-sm font-semibold text-muted">Sold ({sold.length} cards)</p>
        </div>
        <div className="card border-b-4 border-b-sun p-5">
          <p className="font-display text-3xl font-bold">{formatPrice(outstanding)}</p>
          <p className="text-sm font-semibold text-muted">Still on active cards</p>
        </div>
        <div className="card border-b-4 border-b-violet p-5">
          <p className="font-display text-3xl font-bold">{active.length}</p>
          <p className="text-sm font-semibold text-muted">Active cards</p>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <section className="card overflow-hidden">
          {cards.length === 0 ? (
            <p className="p-8 text-center text-muted">No gift cards yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {cards.map((card) => (
                <li key={card.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{card.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          card.status === "void"
                            ? "bg-danger/10 text-danger"
                            : card.balanceCents === 0
                              ? "bg-border text-muted"
                              : "bg-lime/20 text-lime-ink"
                        }`}
                      >
                        {card.status === "void" ? "Void" : card.balanceCents === 0 ? "Used up" : "Active"}
                      </span>
                      <span className="text-xs text-muted">{card.source === "issued" ? "Issued by you" : "Purchased"}</span>
                    </p>
                    <p className="mt-1 truncate text-sm">
                      For <strong>{card.recipientName}</strong>
                      {card.recipientEmail && <span className="text-muted"> · {card.recipientEmail}</span>}
                      {card.buyerName && <span className="text-muted"> · from {card.buyerName}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(card.createdAt, studio.timeZone, "short")}
                      {card.deliveredAt
                        ? ` · emailed ${formatDate(card.deliveredAt, studio.timeZone, "short")}`
                        : card.deliverOn
                          ? ` · sends ${card.deliverOn}`
                          : card.recipientEmail
                            ? ""
                            : " · not emailed"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold">{formatPrice(card.balanceCents)}</p>
                    <p className="text-xs text-muted">of {formatPrice(card.amountCents)}</p>
                  </div>
                  {card.status === "active" && (
                    <div className="flex gap-2">
                      {card.recipientEmail && (
                        <ConfirmButton action={resendGiftCard.bind(null, card.id)} confirmText={`Email this gift card to ${card.recipientEmail} again?`} pendingLabel="Sending…">
                          Resend
                        </ConfirmButton>
                      )}
                      <ConfirmButton
                        action={voidGiftCard.bind(null, card.id)}
                        confirmText={`Void gift card ${card.code}? It can't be used anymore.`}
                        pendingLabel="Voiding…"
                        danger
                      >
                        Void
                      </ConfirmButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-display text-2xl font-bold">Issue a gift card</h2>
          <p className="mt-1 text-sm text-muted">Free cards for giveaways, raffles, or a thank-you. No payment is taken.</p>
          <div className="mt-5">
            <IssueForm />
          </div>
        </section>
      </div>
    </div>
  );
}
