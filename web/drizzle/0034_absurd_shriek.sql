CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_id" uuid NOT NULL,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_rewards_referred_id_unique" UNIQUE("referred_id")
);
--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "referred_by_id" uuid;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referrer_id_photographers_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_referred_id_photographers_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_rewards_referrer_idx" ON "referral_rewards" USING btree ("referrer_id","created_at");--> statement-breakpoint
ALTER TABLE "photographers" ADD CONSTRAINT "photographers_referral_code_unique" UNIQUE("referral_code");