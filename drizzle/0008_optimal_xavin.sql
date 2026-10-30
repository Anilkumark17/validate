CREATE TYPE "public"."persona_status" AS ENUM('draft', 'approved');--> statement-breakpoint
CREATE TABLE "persona" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"jtbd_summary" text DEFAULT '' NOT NULL,
	"mindset_summary" text DEFAULT '' NOT NULL,
	"segment_hints" text[] DEFAULT '{}' NOT NULL,
	"system_prompt" text DEFAULT '' NOT NULL,
	"status" "persona_status" DEFAULT 'draft' NOT NULL,
	"source" "creation_source" DEFAULT 'user_created' NOT NULL,
	"source_customer_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "persona" ADD CONSTRAINT "persona_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "persona_project_idx" ON "persona" USING btree ("project_id");