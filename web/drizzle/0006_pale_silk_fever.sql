ALTER TABLE "inquiries" ADD COLUMN "source" text DEFAULT 'pasted' NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "studio_slug" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "studio_tagline" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "studio_bio" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "service_area" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "offered_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "shoot_locations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "quote_only_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD CONSTRAINT "photographers_studio_slug_unique" UNIQUE("studio_slug");