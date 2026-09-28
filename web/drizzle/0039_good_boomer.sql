CREATE TABLE "store_shipping_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"ship_to" jsonb NOT NULL,
	"rates" jsonb NOT NULL,
	"items_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "swaggpress_key" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "swaggpress_business" text;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "swaggpress_card_on_file" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "swaggpress_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN "lab_variant_id" integer;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN "lab_product_id" integer;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_shipping_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_shipping_service" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_rate_id" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_order_number" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_error" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_carrier" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_tracking" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "lab_shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_product_id" integer;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_unavailable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_shipping_quotes" ADD CONSTRAINT "store_shipping_quotes_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;