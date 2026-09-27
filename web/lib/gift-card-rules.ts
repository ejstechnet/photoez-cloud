// Gift card rules, shared by the purchase page, the booking form, and the
// dashboard. Pure functions, tested in gift-card-rules.test.ts.

// Letters and digits that can't be mistaken for each other (no 0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// "GIFT-7KQ2-M9XD", from 8 random bytes.
export function giftCode(randomBytes: Uint8Array) {
  const chars = Array.from(randomBytes.slice(0, 8), (b) => ALPHABET[b % ALPHABET.length]);
  return `GIFT-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

// What a client typed, tidied: "gift 7kq2 m9xd" → "GIFT-7KQ2-M9XD".
export function normalizeGiftCode(input: string) {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^GIFT/, "");
  if (bare.length !== 8) return input.trim().toUpperCase();
  return `GIFT-${bare.slice(0, 4)}-${bare.slice(4)}`;
}

export type GiftSettings = { amounts: number[]; minCents: number | null; maxCents: number | null };

// A buyer's amount must be a preset, or inside the custom range if the
// studio allows custom amounts.
export function checkGiftAmount(cents: number, settings: GiftSettings): string | null {
  if (!Number.isInteger(cents) || cents <= 0) return "Choose an amount.";
  if (settings.amounts.includes(cents)) return null;
  if (settings.minCents === null || settings.maxCents === null) return "Choose one of the amounts shown.";
  if (cents < settings.minCents || cents > settings.maxCents) {
    return `Choose an amount from $${settings.minCents / 100} to $${settings.maxCents / 100}.`;
  }
  if (cents % 100 !== 0) return "Use a whole-dollar amount.";
  return null;
}

// How much of a card goes toward what's still owed (never more than either).
export function giftCardApplies(balanceCents: number, owedCents: number) {
  return Math.max(0, Math.min(balanceCents, owedCents));
}

// Preset amounts from a studio's settings field: "50, 100, 250" → cents.
export function parseAmountList(text: string): number[] | null {
  const parts = text
    .split(/[,\s]+/)
    .map((p) => p.replace(/^\$/, ""))
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 6) return null;
  const cents = parts.map((p) => (/^\d{1,5}$/.test(p) ? Number(p) * 100 : NaN));
  if (cents.some((c) => !Number.isFinite(c) || c <= 0)) return null;
  return [...new Set(cents)].sort((a, b) => a - b);
}
