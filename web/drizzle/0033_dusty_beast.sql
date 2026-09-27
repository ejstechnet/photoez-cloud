ALTER TABLE "photographers" ADD COLUMN "directory_listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "directory_zip" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "directory_city" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "directory_state" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "directory_lat" double precision;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "directory_lng" double precision;