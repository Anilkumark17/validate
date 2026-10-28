CREATE TYPE "public"."creation_source" AS ENUM('ai_generated', 'user_created');--> statement-breakpoint
CREATE TYPE "public"."evidence_interpretation" AS ENUM('supports', 'contradicts', 'inconclusive');--> statement-breakpoint
CREATE TYPE "public"."evidence_strength" AS ENUM('weak', 'moderate', 'strong');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('interview', 'survey', 'prototype_test', 'experiment', 'analytics', 'observation', 'secondary_research');--> statement-breakpoint
CREATE TYPE "public"."generation_kind" AS ENUM('initial', 'refine');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."interview_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('generated', 'ready_to_validate', 'validation_in_progress', 'evidence_collected', 'validated', 'invalidated', 'needs_more_evidence');--> statement-breakpoint
CREATE TABLE "assumption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'problem_severity' NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"impact" smallint NOT NULL,
	"uncertainty" smallint NOT NULL,
	"risk" smallint GENERATED ALWAYS AS (impact * uncertainty) STORED,
	"confidence" smallint,
	"validation_method" text DEFAULT '' NOT NULL,
	"validation_questions" text[] DEFAULT '{}' NOT NULL,
	"experiment_description" text DEFAULT '' NOT NULL,
	"success_criteria" text DEFAULT '' NOT NULL,
	"status" "validation_status" DEFAULT 'generated' NOT NULL,
	"source" "creation_source" DEFAULT 'ai_generated' NOT NULL,
	"dedupe_key" text NOT NULL,
	"generation_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assumption_dedupe_uq" UNIQUE("project_id","dedupe_key"),
	CONSTRAINT "assumption_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "assumption_impact_chk" CHECK ("assumption"."impact" between 1 and 5),
	CONSTRAINT "assumption_uncertainty_chk" CHECK ("assumption"."uncertainty" between 1 and 5),
	CONSTRAINT "assumption_confidence_chk" CHECK ("assumption"."confidence" is null or "assumption"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "assumption_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"assumption_id" uuid NOT NULL,
	"from_status" "validation_status" NOT NULL,
	"to_status" "validation_status" NOT NULL,
	"rationale" text NOT NULL,
	"interpretation" text,
	"evidence_ids" uuid[] DEFAULT '{}' NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assumption_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"assumption_id" uuid NOT NULL,
	"stakeholder_id" uuid,
	"meeting_id" uuid,
	"type" "evidence_type" NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"summary" text NOT NULL,
	"interpretation" "evidence_interpretation" NOT NULL,
	"strength" "evidence_strength" DEFAULT 'moderate' NOT NULL,
	"researched_on" date NOT NULL,
	"reference" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assumption_stakeholder" (
	"project_id" uuid NOT NULL,
	"assumption_id" uuid NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assumption_stakeholder_assumption_id_stakeholder_id_pk" PRIMARY KEY("assumption_id","stakeholder_id")
);
--> statement-breakpoint
CREATE TABLE "generation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "generation_kind" NOT NULL,
	"status" "generation_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"input" jsonb,
	"model" text,
	"examples" text[] DEFAULT '{}' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_run_idem_uq" UNIQUE("project_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "interview_guide" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stakeholder_id" uuid,
	"title" text NOT NULL,
	"assumption_ids" uuid[] DEFAULT '{}' NOT NULL,
	"content" jsonb NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"why_it_matters" text DEFAULT '' NOT NULL,
	"relevance" smallint DEFAULT 3 NOT NULL,
	"interview_priority" "interview_priority" DEFAULT 'medium' NOT NULL,
	"recruitment_criteria" text DEFAULT '' NOT NULL,
	"interview_questions" text[] DEFAULT '{}' NOT NULL,
	"expected_evidence" text DEFAULT '' NOT NULL,
	"source" "creation_source" DEFAULT 'ai_generated' NOT NULL,
	"dedupe_key" text NOT NULL,
	"generation_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stakeholder_dedupe_uq" UNIQUE("project_id","dedupe_key"),
	CONSTRAINT "stakeholder_id_project_uq" UNIQUE("id","project_id"),
	CONSTRAINT "stakeholder_relevance_chk" CHECK ("stakeholder"."relevance" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "audience_state" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "assumption" ADD CONSTRAINT "assumption_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption" ADD CONSTRAINT "assumption_generation_run_id_generation_run_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_decision" ADD CONSTRAINT "assumption_decision_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_decision" ADD CONSTRAINT "assumption_decision_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_decision" ADD CONSTRAINT "assumption_decision_assumption_id_project_id_assumption_id_project_id_fk" FOREIGN KEY ("assumption_id","project_id") REFERENCES "public"."assumption"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_evidence" ADD CONSTRAINT "assumption_evidence_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_evidence" ADD CONSTRAINT "assumption_evidence_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_evidence" ADD CONSTRAINT "assumption_evidence_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_evidence" ADD CONSTRAINT "assumption_evidence_assumption_id_project_id_assumption_id_project_id_fk" FOREIGN KEY ("assumption_id","project_id") REFERENCES "public"."assumption"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_evidence" ADD CONSTRAINT "assumption_evidence_stakeholder_id_project_id_stakeholder_id_project_id_fk" FOREIGN KEY ("stakeholder_id","project_id") REFERENCES "public"."stakeholder"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_stakeholder" ADD CONSTRAINT "assumption_stakeholder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_stakeholder" ADD CONSTRAINT "assumption_stakeholder_assumption_id_project_id_assumption_id_project_id_fk" FOREIGN KEY ("assumption_id","project_id") REFERENCES "public"."assumption"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumption_stakeholder" ADD CONSTRAINT "assumption_stakeholder_stakeholder_id_project_id_stakeholder_id_project_id_fk" FOREIGN KEY ("stakeholder_id","project_id") REFERENCES "public"."stakeholder"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_run" ADD CONSTRAINT "generation_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_guide" ADD CONSTRAINT "interview_guide_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_guide" ADD CONSTRAINT "interview_guide_stakeholder_id_project_id_stakeholder_id_project_id_fk" FOREIGN KEY ("stakeholder_id","project_id") REFERENCES "public"."stakeholder"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder" ADD CONSTRAINT "stakeholder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholder" ADD CONSTRAINT "stakeholder_generation_run_id_generation_run_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assumption_project_status_idx" ON "assumption" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "assumption_decision_assumption_idx" ON "assumption_decision" USING btree ("assumption_id","created_at");--> statement-breakpoint
CREATE INDEX "assumption_evidence_assumption_idx" ON "assumption_evidence" USING btree ("assumption_id");--> statement-breakpoint
CREATE INDEX "assumption_evidence_stakeholder_idx" ON "assumption_evidence" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE INDEX "assumption_stakeholder_stakeholder_idx" ON "assumption_stakeholder" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE INDEX "generation_run_project_idx" ON "generation_run" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "interview_guide_project_idx" ON "interview_guide" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "stakeholder_project_idx" ON "stakeholder" USING btree ("project_id");