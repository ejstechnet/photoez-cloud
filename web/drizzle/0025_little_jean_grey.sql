CREATE TABLE "gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"code" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_cents" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"source" text DEFAULT 'purchased' NOT NULL,
	"buyer_name" text,
	"buyer_email" text,
	"recipient_name" text NOT NULL,
	"recipient_email" text,
	"message" text,
	"deliver_on" date,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_cards_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "gift_card_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "gift_card_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "gift_card_id" uuid;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "gift_cards_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "gift_card_amounts" jsonb DEFAULT '[5000,10000,25000]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "gift_card_min_cents" integer DEFAULT 2500;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "gift_card_max_cents" integer DEFAULT 100000;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_cards_photographer_idx" ON "gift_cards" USING btree ("photographer_id","created_at");