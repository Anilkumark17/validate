CREATE TYPE "public"."fact_kind" AS ENUM('behavior', 'pain', 'goal', 'language', 'constraint', 'tone');--> statement-breakpoint
CREATE TABLE "fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"segment_id" uuid,
	"kind" "fact_kind" NOT NULL,
	"statement" text NOT NULL,
	"quote" text,
	"speaker" text,
	"phrases" text[] DEFAULT '{}' NOT NULL,
	"outbound_test" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assumption" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "voice" jsonb;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "voice_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_segment_id_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fact_project_idx" ON "fact" USING btree ("project_id");