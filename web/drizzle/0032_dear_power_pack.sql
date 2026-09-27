ALTER TABLE "photographers" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "billing_customer_id" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "subscription_id" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "plan_interval" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "current_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "hide_branding" boolean DEFAULT false NOT NULL;