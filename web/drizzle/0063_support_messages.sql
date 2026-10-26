CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"topic" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"studio" text,
	"page_url" text,
	"message" text NOT NULL,
	"user_agent" text,
	"photographer_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_status_idx" ON "support_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_email_idx" ON "support_messages" USING btree ("email","created_at");