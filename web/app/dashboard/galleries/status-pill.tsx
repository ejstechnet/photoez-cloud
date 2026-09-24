const styles = {
  draft: "bg-sun/25 text-foreground",
  published: "bg-lime/20 text-lime-ink",
  archived: "bg-border text-muted",
} as const;

export function StatusPill({ status }: { status: keyof typeof styles }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}
