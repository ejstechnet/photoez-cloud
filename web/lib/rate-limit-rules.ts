// The counting behind lib/rate-limit.ts (no Next.js, so it's tested in
// rate-limit-rules.test.ts).

export type Hits = Map<string, number[]>;

// Records a try for `key` at `now` and says whether it's allowed: at most
// `max` tries in the last `windowMs`. Refused tries don't count.
export function allowHit(hits: Hits, key: string, now: number, max: number, windowMs: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Now and then, forget visitors with nothing recent so the map stays small.
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (!times.some((t) => t > now - windowMs)) hits.delete(k);
  }
  return true;
}
