ALTER TABLE "photographers" ADD COLUMN "calendar_token" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD CONSTRAINT "photographers_calendar_token_unique" UNIQUE("calendar_token");