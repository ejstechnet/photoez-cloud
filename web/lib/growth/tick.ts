import { sendGrowthDigest } from "./digest";
import { runDiscovery } from "./discover";

// Growth's share of the server's 15-minute cron (/api/cron/reminders): read
// feeds that are due, score what's new, and send the daily summary once it's
// time. Each part fails on its own, so a broken feed never stops the email
// (and neither ever stops booking reminders: the cron runs this after
// answering).
export async function runGrowthTick(now = new Date()) {
  const discovery = await runDiscovery({ now }).catch((e) => (console.error("Growth discovery failed", e), null));
  const digest = await sendGrowthDigest(now).catch((e) => (console.error("Growth digest failed", e), "failed" as const));
  return { discovery, digest };
}
