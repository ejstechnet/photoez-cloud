ALTER TABLE "payments" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "extra_photo_price_cents" integer;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "extras_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "extras_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "gallery_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "quantity" integer;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "extra_photo_price_cents" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;