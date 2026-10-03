CREATE TABLE "migration_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"source_base" text NOT NULL,
	"key_sealed" text NOT NULL,
	"studio_name" text,
	"phase" text DEFAULT 'clients' NOT NULL,
	"offset" integer DEFAULT 0 NOT NULL,
	"hide_sessions" boolean DEFAULT true NOT NULL,
	"totals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"done" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "migration_imports_photographer_id_unique" UNIQUE("photographer_id")
);
--> statement-breakpoint
CREATE TABLE "migration_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"source_id" text NOT NULL,
	"dest_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "migration_map_unique" UNIQUE("photographer_id","source","kind","source_id")
);
--> statement-breakpoint
ALTER TABLE "migration_imports" ADD CONSTRAINT "migration_imports_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_map" ADD CONSTRAINT "migration_map_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;