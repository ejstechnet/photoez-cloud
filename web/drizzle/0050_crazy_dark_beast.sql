ALTER TABLE "galleries" ADD COLUMN "slideshow_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "slideshow_song_key" text;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "slideshow_song_name" text;