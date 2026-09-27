import type { EmailKind } from "@/lib/email/send";

// How each kind of email and each send status reads in the Email log.

export const KIND_LABELS: Record<EmailKind, string> = {
  booking_confirmed: "Booking confirmed",
  booking_new: "New booking (to you)",
  booking_cancelled: "Booking cancelled",
  booking_rescheduled: "Booking rescheduled",
  contract_signed: "Contract signed",
  payment_received: "Payment received",
  session_reminder: "Session reminder",
  balance_reminder: "Balance reminder",
  gallery_link: "Gallery link",
  gallery_finals: "Final photos ready",
  gallery_expiring: "Gallery closing soon",
  selections_submitted: "Picks submitted (to you)",
  inquiry_reply: "Inquiry reply",
  inquiry_new: "New inquiry (to you)",
  password_reset: "Password reset",
  test: "Test email",
};

export const kindLabel = (kind: string) => KIND_LABELS[kind as EmailKind] ?? kind;

export const STATUS_STYLES = {
  sent: { label: "Sent", className: "bg-lime/20 text-lime-ink" },
  failed: { label: "Failed", className: "bg-danger/10 text-danger" },
  skipped: { label: "Not sent", className: "bg-sun/25 text-foreground" },
} as const;
