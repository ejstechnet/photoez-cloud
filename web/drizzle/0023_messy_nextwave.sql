CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"gallery_id" uuid,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"display_name" text,
	"rating" integer,
	"body" text,
	"photo_id" uuid,
	"photo_consent" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_gallery_id_unique" UNIQUE("gallery_id"),
	CONSTRAINT "reviews_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "review_request_days" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_photographer_idx" ON "reviews" USING btree ("photographer_id","status");