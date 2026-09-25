const styles = {
  confirmed: "bg-lime text-brand-deep",
  completed: "bg-brand text-white",
  cancelled: "bg-danger text-white",
} as const;

export function BookingStatusPill({ status }: { status: keyof typeof styles }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${styles[status]}`}>
      {status}
    </span>
  );
}
