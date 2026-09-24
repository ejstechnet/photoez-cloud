import { STATUS_LABELS, type GalleryStatus } from "@/lib/gallery-status";

const styles: Record<GalleryStatus, string> = {
  pending: "bg-sky-light text-brand-deep",
  submitted: "bg-sun text-brand-deep",
  paid_and_submitted: "bg-sky text-white",
  delivered: "bg-lime text-brand-deep",
  completed: "bg-brand text-white",
  expired: "bg-danger text-white",
};

export function StatusPill({ status }: { status: GalleryStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
