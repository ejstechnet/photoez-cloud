CREATE TABLE "assistant_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"summary" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_proposals_photographer_idx" ON "assistant_proposals" USING btree ("photographer_id","created_at");