CREATE TABLE "studio_email_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"send_id" uuid NOT NULL,
	"photographer_id" uuid,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "studio_email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"heading" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"button_label" text DEFAULT '' NOT NULL,
	"button_url" text DEFAULT '' NOT NULL,
	"template_name" text,
	"status" text DEFAULT 'sending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "studio_email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"heading" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"button_label" text DEFAULT '' NOT NULL,
	"button_url" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "marketing_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "studio_email_recipients" ADD CONSTRAINT "studio_email_recipients_send_id_studio_email_sends_id_fk" FOREIGN KEY ("send_id") REFERENCES "public"."studio_email_sends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_email_recipients" ADD CONSTRAINT "studio_email_recipients_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_email_recipients_send_idx" ON "studio_email_recipients" USING btree ("send_id","status");--> statement-breakpoint
CREATE INDEX "studio_email_sends_created_idx" ON "studio_email_sends" USING btree ("created_at");