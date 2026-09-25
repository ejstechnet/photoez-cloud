CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signed_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"template_id" uuid,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"signer_name" text NOT NULL,
	"signature_type" text NOT NULL,
	"signature_data" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_ip" text,
	"user_agent" text,
	CONSTRAINT "signed_contracts_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "contract_template_id" uuid;--> statement-breakpoint
ALTER TABLE "session_types" ADD COLUMN "no_contract" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signed_contracts" ADD CONSTRAINT "signed_contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_templates_photographer_idx" ON "contract_templates" USING btree ("photographer_id");--> statement-breakpoint
ALTER TABLE "session_types" ADD CONSTRAINT "session_types_contract_template_id_contract_templates_id_fk" FOREIGN KEY ("contract_template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;