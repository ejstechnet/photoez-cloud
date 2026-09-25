import type { BookingStatus } from "@/lib/booking/status";

const styles: Record<BookingStatus, { label: string; className: string }> = {
  pending_payment: { label: "Awaiting payment", className: "bg-sun text-brand-deep" },
  confirmed: { label: "Confirmed", className: "bg-lime text-brand-deep" },
  completed: { label: "Completed", className: "bg-brand text-white" },
  cancelled: { label: "Cancelled", className: "bg-danger text-white" },
};

export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const style = styles[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${style.className}`}>
      {style.label}
    </span>
  );
}
