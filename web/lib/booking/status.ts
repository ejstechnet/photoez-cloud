// Booking statuses. pending_payment holds a time while the client pays the
// deposit; it becomes confirmed when Stripe reports the payment.
export const BOOKING_STATUSES = ["pending_payment", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// How long a pending booking holds its time (Stripe Checkout's minimum too).
export const PAYMENT_HOLD_MINUTES = 30;
