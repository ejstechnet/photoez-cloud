ALTER TABLE "bookings" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "galleries" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "gallery_type" text DEFAULT 'proofing' NOT NULL;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_booking_id_unique" UNIQUE("booking_id");