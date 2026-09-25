// Special prices: a session can have a sale price, shown with the regular
// price struck through, optionally until an end date (inclusive, on the
// studio's own calendar). Pure logic, tested in pricing.test.ts.

export type Priced = { priceCents: number; salePriceCents: number | null; saleEndsOn: string | null };

// What the client pays today, and the regular price to strike through when on sale.
export function currentPrice(session: Priced, today: string): { priceCents: number; wasCents: number | null } {
  const onSale =
    session.salePriceCents !== null &&
    session.salePriceCents < session.priceCents &&
    (session.saleEndsOn === null || today <= session.saleEndsOn);
  return onSale ? { priceCents: session.salePriceCents!, wasCents: session.priceCents } : { priceCents: session.priceCents, wasCents: null };
}
