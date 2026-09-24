ALTER TABLE "galleries" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "free_limit" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "watermark_key" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "watermark_opacity" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "watermark_position" text DEFAULT 'center' NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "watermark_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "proof_made_at" timestamp with time zone;--> statement-breakpoint
-- Hand-written: move galleries from the old stage names to the PhotoEZ ones.
UPDATE "galleries" SET "status" = CASE "status" WHEN 'archived' THEN 'completed' ELSE 'pending' END
  WHERE "status" IN ('draft', 'published', 'archived');