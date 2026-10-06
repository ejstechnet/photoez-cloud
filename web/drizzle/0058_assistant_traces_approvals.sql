CREATE TABLE "ai_trace_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" uuid NOT NULL,
	"photographer_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"step_type" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"tool_name" text,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"truncated" boolean DEFAULT false NOT NULL,
	"model" text,
	"stop_reason" text,
	"request_id" text,
	"input_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"output_tokens" integer,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"latency_ms" integer,
	CONSTRAINT "ai_trace_steps_order" UNIQUE("trace_id","step_index")
);
--> statement-breakpoint
CREATE TABLE "ai_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"conversation_id" uuid,
	"turn_index" integer,
	"question" text NOT NULL,
	"model" text NOT NULL,
	"outcome" text DEFAULT 'running' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"latency_ms" integer
);
--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "tool_name" text;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "args_hash" text;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "deliveries" jsonb;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "trace_id" uuid;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD COLUMN "run_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_trace_steps" ADD CONSTRAINT "ai_trace_steps_trace_id_ai_traces_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_trace_steps" ADD CONSTRAINT "ai_trace_steps_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traces" ADD CONSTRAINT "ai_traces_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_traces" ADD CONSTRAINT "ai_traces_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_traces_photographer_idx" ON "ai_traces" USING btree ("photographer_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_traces_started_idx" ON "ai_traces" USING btree ("started_at");--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_conversation_id_assistant_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."assistant_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_trace_id_ai_traces_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ADD CONSTRAINT "assistant_proposals_decided_by_photographers_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."photographers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Cards made before this change: name their tool, give them the 24-hour
-- expiry, and move them to the new statuses. They have no args_hash, so a
-- still-pending one can never run; it shows as expired.
UPDATE "assistant_proposals" SET "tool_name" = CASE "kind"
  WHEN 'client_email' THEN 'propose_client_email'
  WHEN 'gallery_emails' THEN 'propose_gallery_emails'
  WHEN 'balance_reminders' THEN 'propose_balance_reminders'
  ELSE 'propose_booking_status' END,
  "expires_at" = "created_at" + interval '24 hours',
  "decided_at" = CASE WHEN "status" IN ('done', 'dismissed') THEN "done_at" END,
  "decided_by" = CASE WHEN "status" IN ('done', 'dismissed') THEN "photographer_id" END,
  "status" = CASE "status" WHEN 'done' THEN 'executed' WHEN 'dismissed' THEN 'rejected' ELSE 'expired' END,
  "done_at" = COALESCE("done_at", now());--> statement-breakpoint
ALTER TABLE "assistant_proposals" ALTER COLUMN "tool_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_proposals" ALTER COLUMN "expires_at" SET NOT NULL;
