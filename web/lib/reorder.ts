// Moves one item up (by = -1) or down (by = 1) in an ordered list of ids.
// Returns the new order, or null when the item is missing or already at that
// end. Used to reorder sessions and add-ons; tested in reorder.test.ts.
export function moveInList(ids: string[], id: string, by: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
