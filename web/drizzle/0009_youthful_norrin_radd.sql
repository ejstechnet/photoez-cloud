CREATE TABLE "blackout_dates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "booking_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"buffer_minutes" integer DEFAULT 15 NOT NULL,
	CONSTRAINT "booking_hours_day_unique" UNIQUE("photographer_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"session_type_id" uuid,
	"client_id" uuid,
	"session_name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"deposit_percent" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_phone" text,
	"notes" text,
	"manage_token" text NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
CREATE TABLE "session_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"deposit_percent" integer DEFAULT 100 NOT NULL,
	"location" text,
	"photos_included" integer,
	"hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "time_zone" text DEFAULT 'America/Los_Angeles' NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "min_notice_days" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "blackout_dates" ADD CONSTRAINT "blackout_dates_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_hours" ADD CONSTRAINT "booking_hours_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_type_id_session_types_id_fk" FOREIGN KEY ("session_type_id") REFERENCES "public"."session_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_types" ADD CONSTRAINT "session_types_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blackout_dates_photographer_idx" ON "blackout_dates" USING btree ("photographer_id","start_date");--> statement-breakpoint
CREATE INDEX "bookings_photographer_idx" ON "bookings" USING btree ("photographer_id","starts_at");--> statement-breakpoint
CREATE INDEX "session_types_photographer_idx" ON "session_types" USING btree ("photographer_id","sort_order");--> statement-breakpoint
-- Hand-written: the database itself refuses overlapping active bookings for
-- the same photographer, even if two clients click "Book" at the same moment.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ends_after_start" CHECK ("ends_at" > "starts_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("photographer_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" <> 'cancelled');
