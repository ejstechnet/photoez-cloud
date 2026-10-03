CREATE TABLE "migration_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "migration_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "migration_keys" ADD CONSTRAINT "migration_keys_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "migration_keys_photographer_idx" ON "migration_keys" USING btree ("photographer_id");