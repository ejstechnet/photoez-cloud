CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photographer_id" uuid NOT NULL,
	"client_id" uuid,
	"inquiry_id" uuid,
	"kind" text NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_phone" text,
	"title" text NOT NULL,
	"event_date" date,
	"items" jsonb NOT NULL,
	"tax_bps" integer DEFAULT 0 NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"plan" jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"due_date" date,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"manual_payments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"terms" text,
	"token" text NOT NULL,
	"contract_template_id" uuid,
	"contract_title" text,
	"contract_content" text,
	"signer_name" text,
	"signature_type" text,
	"signature_data" text,
	"signed_at" timestamp with time zone,
	"signer_ip" text,
	"signer_user_agent" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"decline_reason" text,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"approval_reminder_at" timestamp with time zone,
	"payment_reminder_key" text,
	"overdue_notice_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_token_unique" UNIQUE("token"),
	CONSTRAINT "invoices_number_unique" UNIQUE("photographer_id","number")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "invoice_tax_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "invoice_deposit_percent" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "photographers" ADD COLUMN "invoice_terms" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_photographer_id_photographers_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_template_id_contract_templates_id_fk" FOREIGN KEY ("contract_template_id") REFERENCES "public"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_photographer_idx" ON "invoices" USING btree ("photographer_id","created_at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");