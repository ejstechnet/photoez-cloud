ALTER TABLE "store_order_items" ADD COLUMN "fields" jsonb;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN "field_photo_ids" jsonb;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_mode" text;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;