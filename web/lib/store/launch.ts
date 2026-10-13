import { isOwnerEmail } from "../signup-stats.ts";

// The store is "coming soon" until STORE_OPEN=1 is set in .env. Until then
// only PhotoEZ Cloud's owner (OWNER_EMAILS) can set it up and sell from it, so
// SwaggPress products can be finished and tested on the live site; everyone
// else sees a coming-soon page, and their client galleries show no shop.
// Decided with Elle 2026-10-12: launch PhotoEZ Cloud with the store marked
// coming soon rather than wait for it. Tested in launch.test.ts.

export function storeIsOpen(): boolean {
  return process.env.STORE_OPEN === "1";
}

// Whether this photographer can use the store yet.
export function storeOpenFor(email: string | null | undefined): boolean {
  return storeIsOpen() || isOwnerEmail(email);
}
