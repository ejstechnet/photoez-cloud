// Up/down buttons for reordering a list item. Each is a tiny form posting to a
// server action, so reordering works even before the page's JavaScript loads.
export function MoveButtons({
  label,
  isFirst,
  isLast,
  moveUp,
  moveDown,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  moveUp: () => Promise<void>;
  moveDown: () => Promise<void>;
}) {
  const button =
    "grid size-9 place-items-center rounded-lg border-2 border-border text-sm font-bold text-muted transition hover:border-lime-ink hover:text-foreground disabled:opacity-30 disabled:hover:border-border";
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <form action={moveUp}>
        <button type="submit" disabled={isFirst} className={button} title="Move up" aria-label={`Move ${label} up`}>
          ↑
        </button>
      </form>
      <form action={moveDown}>
        <button type="submit" disabled={isLast} className={button} title="Move down" aria-label={`Move ${label} down`}>
          ↓
        </button>
      </form>
    </div>
  );
}
