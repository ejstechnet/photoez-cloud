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
  assistant_email: "Message from you",
  gift_card: "Gift card",
  gift_card_receipt: "Gift card receipt",
  gift_card_sold: "Gift card sold (to you)",
  review_request: "Review request",
  review_new: "New review (to you)",
  referral_credit: "Referral credit",
  store_order: "Store order receipt",
  store_order_new: "New store order (to you)",
  store_order_shipped: "Store order shipped",
  password_reset: "Password reset",
  email_verification: "Email confirmation",
  trial_reminder: "Pro trial ending",
  invoice_sent: "Quote or invoice",
  invoice_reminder: "Payment reminder",
  invoice_overdue: "Payment overdue",
  quote_reminder: "Quote reminder",
  invoice_payment: "Invoice payment",
  invoice_update: "Quote or invoice update (to you)",
  test: "Test email",
};

export const kindLabel = (kind: string) => KIND_LABELS[kind as EmailKind] ?? kind;

export const STATUS_STYLES = {
  sent: { label: "Sent", className: "bg-lime/20 text-lime-ink" },
  failed: { label: "Failed", className: "bg-danger/10 text-danger" },
  skipped: { label: "Not sent", className: "bg-sun/25 text-foreground" },
} as const;
