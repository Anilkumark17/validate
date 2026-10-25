CREATE TYPE "public"."assumption_status" AS ENUM('untested', 'supporting', 'contradicted', 'mixed', 'validated', 'invalidated');--> statement-breakpoint
CREATE TYPE "public"."assumption_type" AS ENUM('desirability', 'feasibility', 'viability');--> statement-breakpoint
CREATE TYPE "public"."evidence_stance" AS ENUM('supports', 'contradicts', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."link_origin" AS ENUM('model', 'user');--> statement-breakpoint
CREATE TYPE "public"."meeting_source" AS ENUM('live_call', 'transcript_upload', 'manual');--> statement-breakpoint
CREATE TYPE "public"."meeting_state" AS ENUM('scheduled', 'live', 'ended');--> statement-breakpoint
CREATE TABLE "assumption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"type" "assumption_type" NOT NULL,
	"risk" smallint DEFAULT 3 NOT NULL,
	"owner" text,
	"status" "assumption_status" DEFAULT 'untested' NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"segment_id" uuid,
	"image_url" text,
	"claim" text NOT NULL,
	"quote" text,
	"speaker" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"assumption_id" uuid NOT NULL,
	"stance" "evidence_stance" NOT NULL,
	"strength" smallint DEFAULT 2 NOT NULL,
	"rationale" text,
	"origin" "link_origin" DEFAULT 'model' NOT NULL,
	"rejected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_evidence_assumption_uq" UNIQUE("evidence_id","assumption_id")
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"held_at" date,
	"scheduled_for" timestamp with time zone,
	"invite_code" text NOT NULL,
	"source" "meeting_source" DEFAULT 'live_call' NOT NULL,
	"state" "meeting_state" DEFAULT 'scheduled' NOT NULL,
	"participants" text[] DEFAULT '{}' NOT NULL,
	"job_status" "job_status" DEFAULT 'queued' NOT NULL,
	"job_error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"model_calls" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_user" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"speaker" text,
	"text" text NOT NULL,
	"start_sec" real,
	"end_sec" real,
	"processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segment_meeting_idx_uq" UNIQUE("meeting_id","idx")
);
--> statement-breakpoint
CREATE TABLE "status_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assumption_id" uuid NOT NULL,
	"meeting_id" uuid,
	"from_status" "assumption_status",
	"to_status" "assumption_status" NOT NULL,
	"confidence" real NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assumption" ADD CONSTRAINT "assumption_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_segment_id_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_assumption_id_assumption_id_fk" FOREIGN KEY ("assumption_id") REFERENCES "public"."assumption"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment" ADD CONSTRAINT "segment_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_event" ADD CONSTRAINT "status_event_assumption_id_assumption_id_fk" FOREIGN KEY ("assumption_id") REFERENCES "public"."assumption"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_event" ADD CONSTRAINT "status_event_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assumption_project_idx" ON "assumption" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "evidence_meeting_idx" ON "evidence" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "link_assumption_idx" ON "link" USING btree ("assumption_id");--> statement-breakpoint
CREATE INDEX "meeting_project_idx" ON "meeting" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "segment_meeting_idx" ON "segment" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "status_event_assumption_idx" ON "status_event" USING btree ("assumption_id","created_at");