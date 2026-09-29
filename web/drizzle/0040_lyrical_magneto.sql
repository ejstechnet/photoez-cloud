CREATE TABLE "store_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"gallery_id" uuid NOT NULL,
	"product_id" uuid,
	"design" jsonb NOT NULL,
	"preview_key" text NOT NULL,
	"front_key" text NOT NULL,
	"back_key" text,
	"photo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN "design_id" uuid;--> statement-breakpoint
ALTER TABLE "store_products" ADD COLUMN "lab_design" jsonb;--> statement-breakpoint
ALTER TABLE "store_designs" ADD CONSTRAINT "store_designs_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_designs" ADD CONSTRAINT "store_designs_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_designs" ADD CONSTRAINT "store_designs_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_designs_gallery_idx" ON "store_designs" USING btree ("gallery_id","created_at");--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_design_id_store_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."store_designs"("id") ON DELETE set null ON UPDATE no action;