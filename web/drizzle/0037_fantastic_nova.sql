CREATE TABLE "store_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"photo_id" uuid,
	"product_name" text NOT NULL,
	"variant_label" text NOT NULL,
	"unit_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"crop" jsonb,
	"photo_name" text,
	"fulfillment" text DEFAULT 'self' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"gallery_id" uuid,
	"order_number" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"client_name" text,
	"client_email" text,
	"ship_name" text,
	"ship_line1" text,
	"ship_line2" text,
	"ship_city" text,
	"ship_state" text,
	"ship_postal_code" text,
	"ship_country" text,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"handling_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"crop_to_size" boolean DEFAULT true NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fulfillment" text DEFAULT 'self' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "store_order_id" uuid;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "store_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "store_shipping_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "store_handling_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_order_items_order_idx" ON "store_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "store_orders_photographer_idx" ON "store_orders" USING btree ("photographer_id","created_at");--> statement-breakpoint
CREATE INDEX "store_products_photographer_idx" ON "store_products" USING btree ("photographer_id","sort_order");