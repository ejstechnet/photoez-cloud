// A simple per-visitor limit for the public forms anyone can submit (studio
// inquiries, bookings, gift cards, coupon and credit checks), so a script
// can't flood a studio or run up AI and storage costs. Kept in memory: the
// app runs as one process, and a restart just clears the counts.
import { headers } from "next/headers";
import { allowHit, type Hits } from "./rate-limit-rules.ts";

const hits: Hits = new Map();

// The visitor's address. Apache adds the real one at the end of
// X-Forwarded-For (anything before it came from the visitor and can be faked).
export async function clientIp(): Promise<string> {
  const h = await headers();
  const parts = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || h.get("x-real-ip") || "unknown";
}

// True when this visitor has used up `max` tries of `bucket` in the window.
export async function overLimit(bucket: string, max: number, windowMs: number): Promise<boolean> {
  return !allowHit(hits, `${bucket}:${await clientIp()}`, Date.now(), max, windowMs);
}
