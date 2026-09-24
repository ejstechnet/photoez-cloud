DROP INDEX "photos_gallery_idx";--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "kind" text DEFAULT 'proof' NOT NULL;--> statement-breakpoint
CREATE INDEX "photos_gallery_idx" ON "photos" USING btree ("gallery_id","kind","position");