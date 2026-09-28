ALTER TABLE "bookings" ADD COLUMN "referred_by_client_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "referral_discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "referral_reward_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "referral_rewarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "client_referrals_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "client_referral_reward_cents" integer DEFAULT 2500 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "client_referral_discount_cents" integer DEFAULT 2500 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_referred_by_client_id_clients_id_fk" FOREIGN KEY ("referred_by_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_referral_code_unique" UNIQUE("referral_code");