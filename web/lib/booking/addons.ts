// Add-on math for a booking: which extras the client picked, within each
// add-on's limit, and what they add to the total. Pure logic, tested in
// addons.test.ts; the server runs it again on every booking.

export type OfferedAddon = {
  id: string;
  name: string;
  priceCents: number;
  maxQuantity: number;
  includedQuantity: number;
};

export type AddonLine = OfferedAddon & { quantity: number; lineCents: number };

export type AddonPick =
  | { ok: true; lines: AddonLine[]; addonsCents: number }
  | { ok: false; message: string };

// `picked` maps add-on id → extra quantity (beyond what the session includes).
// Unknown add-ons and out-of-range quantities are refused, not adjusted, so a
// client is never charged for something different from what they chose.
export function pickAddons(offered: OfferedAddon[], picked: Record<string, number>): AddonPick {
  const byId = new Map(offered.map((addon) => [addon.id, addon]));
  const lines: AddonLine[] = [];
  for (const [id, quantity] of Object.entries(picked)) {
    if (quantity === 0) continue;
    const addon = byId.get(id);
    if (!addon) return { ok: false, message: "One of the extras isn't available for this session anymore." };
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > addon.maxQuantity) {
      return { ok: false, message: `You can add up to ${addon.maxQuantity} of ${addon.name}.` };
    }
    lines.push({ ...addon, quantity, lineCents: quantity * addon.priceCents });
  }
  // Keep the session's own order, whatever order the form sent them in.
  lines.sort((a, b) => offered.indexOf(byId.get(a.id)!) - offered.indexOf(byId.get(b.id)!));
  return { ok: true, lines, addonsCents: lines.reduce((sum, line) => sum + line.lineCents, 0) };
}
