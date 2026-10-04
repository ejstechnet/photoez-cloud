ALTER TABLE "photographers" ADD COLUMN "extra_storage_blocks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "storage_subscription_id" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "storage_period_end" timestamp with time zone;