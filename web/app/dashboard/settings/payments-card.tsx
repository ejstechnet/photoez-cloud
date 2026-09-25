import { connectStripe, refreshStripeStatus } from "./stripe-actions";

// Settings > Payments: the photographer's Stripe connection.
export function PaymentsCard({
  configured,
  accountId,
  ready,
}: {
  configured: boolean;
  accountId: string | null;
  ready: boolean;
}) {
  return (
    <section id="payments" className="card scroll-mt-8 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold">Payments</h2>
      <p className="mt-1 text-sm text-muted">
        Clients pay deposits and balances by card, Apple Pay, Google Pay, and pay-over-time options through Stripe.
        Money goes straight to your own Stripe account.
      </p>
      {!configured ? (
        <p className="mt-4 rounded-xl bg-sun/30 px-4 py-3 text-sm font-medium">
          Payments aren&apos;t set up on this PhotoEZ Cloud server yet.
        </p>
      ) : ready ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-lime/15 px-4 py-3">
          <p className="text-sm font-semibold">✓ Stripe connected. Clients pay deposits when they book.</p>
          <a href="https://dashboard.stripe.com" target="_blank" className="btn-secondary">
            Open Stripe
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {accountId && (
            <p className="rounded-xl bg-sun/30 px-4 py-3 text-sm font-medium">
              Stripe needs a few more details before you can take payments.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={connectStripe}>
              <button type="submit" className="btn-primary">
                {accountId ? "Finish Stripe setup" : "Connect Stripe"}
              </button>
            </form>
            {accountId && (
              <form action={refreshStripeStatus}>
                <button type="submit" className="btn-secondary">
                  Check again
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
