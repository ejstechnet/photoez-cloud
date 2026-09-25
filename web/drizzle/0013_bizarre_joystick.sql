CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"max_quantity" integer DEFAULT 10 NOT NULL,
	"image_key" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"addon_id" uuid,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"included_quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_type_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_type_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"included_quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "session_type_addons_unique" UNIQUE("session_type_id","addon_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "addons_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_addons" ADD CONSTRAINT "booking_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_type_addons" ADD CONSTRAINT "session_type_addons_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_type_addons" ADD CONSTRAINT "session_type_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addons_photographer_idx" ON "addons" USING btree ("photographer_id","sort_order");--> statement-breakpoint
CREATE INDEX "booking_addons_booking_idx" ON "booking_addons" USING btree ("booking_id");