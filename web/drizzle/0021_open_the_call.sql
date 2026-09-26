ALTER TABLE "favorites" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "notes_enabled" boolean;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "photo_notes_enabled" boolean DEFAULT true NOT NULL;