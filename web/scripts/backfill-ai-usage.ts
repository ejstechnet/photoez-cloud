// Fills in the AI cost report for usage recorded before costs were (see
// lib/ai/usage-backfill.ts). Safe to run more than once.
//   npm run ai:backfill
import { backfillAiUsage } from "../lib/ai/usage-backfill.ts";

const done = await backfillAiUsage();
console.log(
  `Priced ${done.priced} older usage rows (estimates), ${done.unpriced} left without a price; added ${done.inquiries} triage rows from triaged inquiries.`,
);
process.exit(0);
