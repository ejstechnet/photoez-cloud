CREATE TABLE "growth_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"criteria" jsonb,
	"total" integer,
	"confidence" double precision,
	"ai_usage_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_analyses_cache" UNIQUE("input_hash","stage")
);
--> statement-breakpoint
CREATE TABLE "growth_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"area" text NOT NULL,
	"status" text NOT NULL,
	"plans" text DEFAULT 'All' NOT NULL,
	"reply_note" text,
	"evidence_url" text,
	"verified_at" date NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_features_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "growth_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group" text NOT NULL,
	"phrase" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_keywords_phrase_unique" UNIQUE("phrase")
);
--> statement-breakpoint
CREATE TABLE "growth_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"external_id" text,
	"platform" text NOT NULL,
	"title" text,
	"excerpt" text,
	"content_hash" text,
	"author_label" text,
	"published_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'sales_opportunity' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"score" integer,
	"tier" text,
	"score_override" integer,
	"override_reason" text,
	"next_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_opportunities_canonical_url_unique" UNIQUE("canonical_url"),
	CONSTRAINT "growth_opportunities_source_external" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "growth_outreach" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"analysis_id" uuid,
	"draft" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"posted_text" text,
	"posted_url" text,
	"posted_at" timestamp with time zone,
	"reply_seen_at" timestamp with time zone,
	"follow_up_at" timestamp with time zone,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"kind" text DEFAULT 'manual' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"links_allowed" boolean DEFAULT false NOT NULL,
	"self_promo_allowed" boolean DEFAULT false NOT NULL,
	"disclosure" text DEFAULT 'I make PhotoEZ Cloud, so I''m biased.' NOT NULL,
	"rules_note" text,
	"rules_checked_at" date,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "growth_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"evidence" text,
	"actor" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "growth_analyses" ADD CONSTRAINT "growth_analyses_opportunity_id_growth_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."growth_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_analyses" ADD CONSTRAINT "growth_analyses_ai_usage_id_ai_usage_id_fk" FOREIGN KEY ("ai_usage_id") REFERENCES "public"."ai_usage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_notes" ADD CONSTRAINT "growth_notes_opportunity_id_growth_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."growth_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_source_id_growth_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."growth_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_outreach" ADD CONSTRAINT "growth_outreach_opportunity_id_growth_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."growth_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_outreach" ADD CONSTRAINT "growth_outreach_analysis_id_growth_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."growth_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_status_events" ADD CONSTRAINT "growth_status_events_opportunity_id_growth_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."growth_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "growth_analyses_opportunity_idx" ON "growth_analyses" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "growth_audit_created_idx" ON "growth_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "growth_notes_opportunity_idx" ON "growth_notes" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "growth_opportunities_queue_idx" ON "growth_opportunities" USING btree ("status","tier");--> statement-breakpoint
CREATE INDEX "growth_opportunities_discovered_idx" ON "growth_opportunities" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "growth_opportunities_next_action_idx" ON "growth_opportunities" USING btree ("next_action_at");--> statement-breakpoint
CREATE INDEX "growth_outreach_opportunity_idx" ON "growth_outreach" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "growth_outreach_follow_up_idx" ON "growth_outreach" USING btree ("follow_up_at");--> statement-breakpoint
CREATE INDEX "growth_status_events_opportunity_idx" ON "growth_status_events" USING btree ("opportunity_id","created_at");