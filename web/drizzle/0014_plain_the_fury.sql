CREATE TABLE "gallery_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"photo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "header_image_key" text;--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "sale_price_cents" integer;--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "sale_ends_on" date;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_downloads_gallery_idx" ON "gallery_downloads" USING btree ("gallery_id","created_at");