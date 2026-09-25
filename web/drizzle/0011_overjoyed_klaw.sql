ALTER TABLE "bookings" ADD COLUMN "reschedule_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_due" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "client_changes_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "reschedule_notice_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "free_reschedules" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "cancel_notice_hours" integer DEFAULT 72 NOT NULL;