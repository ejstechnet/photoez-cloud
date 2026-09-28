import type { STORE_ORDER_STATUSES } from "@/db/schema";

const LOOK: Record<(typeof STORE_ORDER_STATUSES)[number], [string, string]> = {
  pending_payment: ["Not paid", "bg-border text-muted"],
  paid: ["To ship", "bg-sun/40 text-brand-deep"],
  shipped: ["Shipped", "bg-lime/25 text-lime-ink"],
  cancelled: ["Cancelled", "bg-border text-muted"],
};

export function StoreOrderPill({ status }: { status: (typeof STORE_ORDER_STATUSES)[number] }) {
  const [label, tone] = LOOK[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase ${tone}`}>{label}</span>;
}
