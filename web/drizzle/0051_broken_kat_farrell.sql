CREATE TABLE "sms_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_consents_phone_unique" UNIQUE("photographer_id","phone")
);
--> statement-breakpoint
CREATE TABLE "sms_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"to_phone" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"twilio_sid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "twilio_account_sid" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "twilio_auth_token" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "sms_from" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "sms_texts" jsonb;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "sms_alert_phone" text;--> statement-breakpoint
ALTER TABLE "sms_consents" ADD CONSTRAINT "sms_consents_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_log" ADD CONSTRAINT "sms_log_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_log_photographer_idx" ON "sms_log" USING btree ("photographer_id","created_at");