ALTER TABLE "store_order_items" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_options" jsonb DEFAULT '[]'::jsonb NOT NULL;