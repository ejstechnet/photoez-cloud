ALTER TABLE "ai_usage" ALTER COLUMN "photographer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "input_uncached_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "cache_write_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "cache_read_tokens" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "token_split_known" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "cost_microdollars" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "price_key" text;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "counts_toward_limit" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "inquiry_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "trace_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "gallery_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_trace_id_ai_traces_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."ai_traces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");