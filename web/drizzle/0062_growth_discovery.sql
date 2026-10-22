CREATE TABLE "growth_job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"source_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"saved" integer DEFAULT 0 NOT NULL,
	"kept" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "growth_opportunities" ADD COLUMN "screened_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "growth_job_runs" ADD CONSTRAINT "growth_job_runs_source_id_growth_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."growth_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "growth_job_runs_source_idx" ON "growth_job_runs" USING btree ("source_id","started_at");--> statement-breakpoint
-- Elle, 2026-10-22: "How do you deliver photos to clients" is one of the most
-- asked questions, and her Facebook "recent posts" search for it. Added by
-- this migration so the live site (already seeded) and new installs both get them.
INSERT INTO "growth_keywords" ("group", "phrase") VALUES ('proofing_galleries', 'how do you deliver photos to clients') ON CONFLICT ("phrase") DO NOTHING;--> statement-breakpoint
INSERT INTO "growth_sources" ("name", "platform", "kind", "config", "links_allowed", "self_promo_allowed", "rules_note") VALUES ('Facebook search: how do you deliver photos to clients', 'facebook', 'manual', '{"searchUrl":"https://www.facebook.com/search/top?q=how%20do%20you%20deliver%20photos%20to%20clients%3F&filters=eyJyZWNlbnRfcG9zdHM6MCI6IntcIm5hbWVcIjpcInJlY2VudF9wb3N0c1wiLFwiYXJnc1wiOlwiXCJ9In0%3D"}', false, false, 'A Facebook search you run yourself (recent posts). Open it from Growth, then save good posts with the bookmark. Each group has its own rules, so drafts play it safe: no link, no pitch.') ON CONFLICT ("name") DO NOTHING;
