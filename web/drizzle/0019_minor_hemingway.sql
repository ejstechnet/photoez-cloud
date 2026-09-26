CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"session_type_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"max_uses" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("photographer_id","code")
);
--> statement-breakpoint
CREATE TABLE "session_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"client_email" text NOT NULL,
	"client_name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"used_cents" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"source_booking_id" uuid,
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "credit_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "credit_valid_months" integer DEFAULT 12;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_source_booking_id_bookings_id_fk" FOREIGN KEY ("source_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_credits_client_idx" ON "session_credits" USING btree ("photographer_id","client_email");