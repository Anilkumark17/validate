ALTER TABLE "meeting" ADD COLUMN "consent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "customer" jsonb;
--> statement-breakpoint
ALTER TABLE "segment" ADD COLUMN "text_en" text;
--> statement-breakpoint
ALTER TABLE "segment" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "segment" ADD COLUMN "confidence" smallint;
--> statement-breakpoint
ALTER TABLE "segment" ADD COLUMN "flags" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "generation_run" ADD COLUMN "meeting_id" uuid;
--> statement-breakpoint
ALTER TABLE "generation_run" ADD CONSTRAINT "generation_run_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
DROP INDEX IF EXISTS "generation_run_one_active_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "generation_run_one_active_uq" ON "generation_run" ("project_id") WHERE status in ('pending', 'running') AND kind <> 'extract';
--> statement-breakpoint
CREATE UNIQUE INDEX "generation_run_one_extract_uq" ON "generation_run" ("meeting_id") WHERE kind = 'extract' AND status in ('pending', 'running');
--> statement-breakpoint
CREATE TABLE "insight" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "meeting_id" uuid NOT NULL,
  "generation_run_id" uuid,
  "status" text DEFAULT 'ai_suggested' NOT NULL,
  "segment_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "t_start" real,
  "t_end" real,
  "quote_en" text NOT NULL,
  "summary_en" text NOT NULL,
  "kind" text NOT NULL,
  "evidence_type" text NOT NULL,
  "led_by_interviewer" boolean DEFAULT false NOT NULL,
  "profile_tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "profile_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "importance" smallint NOT NULL,
  "confidence" smallint NOT NULL,
  "flags" text[] DEFAULT '{}'::text[] NOT NULL,
  "prompt_version" text NOT NULL,
  "model" text,
  "context_log" jsonb,
  "reject_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "insight_status_chk" CHECK ("status" in ('ai_suggested', 'confirmed', 'rejected')),
  CONSTRAINT "insight_importance_chk" CHECK ("importance" between 1 and 5),
  CONSTRAINT "insight_confidence_chk" CHECK ("confidence" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "insight" ADD CONSTRAINT "insight_generation_run_id_generation_run_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_run"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "insight_meeting_idx" ON "insight" ("meeting_id","created_at");
--> statement-breakpoint
CREATE INDEX "insight_project_idx" ON "insight" ("project_id","status");
