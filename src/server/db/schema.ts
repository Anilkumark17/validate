import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const meetingSource = pgEnum("meeting_source", ["live_call", "transcript_upload", "manual"]);
export const jobStatus = pgEnum("job_status", ["queued", "processing", "done", "failed"]);
export const meetingState = pgEnum("meeting_state", ["scheduled", "live", "ended"]);

// ---- Assumption validation board ----
export const validationStatus = pgEnum("validation_status", [
  "generated",
  "ready_to_validate",
  "validation_in_progress",
  "evidence_collected",
  "validated",
  "invalidated",
  "needs_more_evidence",
]);
export const generationStatus = pgEnum("generation_status", ["pending", "running", "completed", "failed"]);
export const generationKind = pgEnum("generation_kind", ["initial", "refine"]);
export const creationSource = pgEnum("creation_source", ["ai_generated", "user_created"]);
export const evidenceType = pgEnum("evidence_type", [
  "interview",
  "survey",
  "prototype_test",
  "experiment",
  "analytics",
  "observation",
  "secondary_research",
]);
export const evidenceInterpretation = pgEnum("evidence_interpretation", ["supports", "contradicts", "inconclusive"]);
export const evidenceStrength = pgEnum("evidence_strength", ["weak", "moderate", "strong"]);
export const interviewPriority = pgEnum("interview_priority", ["high", "medium", "low"]);

export const appUser = pgTable("app_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => appUser.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  targetUser: text("target_user"),
  /** unknown: never asked. detected: stated in the idea. confirmed: user answered. skipped: user declined, audience is provisional. */
  audienceState: text("audience_state").notNull().default("unknown"),
  persona: jsonb("persona"),
  personaUpdatedAt: timestamp("persona_updated_at", { withTimezone: true }),
  voice: jsonb("voice"),
  voiceUpdatedAt: timestamp("voice_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Free text the owner adds about a project (testing phase: text only). */
export const projectContext = pgTable(
  "project_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("project_context_project_idx").on(t.projectId)],
);

export const meeting = pgTable(
  "meeting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    heldAt: date("held_at"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    inviteCode: text("invite_code").notNull().unique(),
    source: meetingSource("source").notNull().default("live_call"),
    state: meetingState("state").notNull().default("scheduled"),
    participants: text("participants").array().notNull().default([]),
    jobStatus: jobStatus("job_status").notNull().default("queued"),
    jobError: text("job_error"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    modelCalls: integer("model_calls").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("meeting_project_idx").on(t.projectId)],
);

export const segment = pgTable(
  "segment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => meeting.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    speaker: text("speaker"),
    text: text("text").notNull(),
    startSec: real("start_sec"),
    endSec: real("end_sec"),
    processed: boolean("processed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("segment_meeting_idx_uq").on(t.meetingId, t.idx), index("segment_meeting_idx").on(t.meetingId)],
);

/** One AI (or refine) generation attempt. The idempotency key makes retries and double submits safe. */
export const generationRun = pgTable(
  "generation_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    kind: generationKind("kind").notNull(),
    status: generationStatus("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    input: jsonb("input"),
    model: text("model"),
    examples: text("examples").array().notNull().default([]),
    attempts: integer("attempts").notNull().default(0),
    summary: text("summary"),
    /** created / skipped counts, suggested changes and possibly obsolete assumptions (refine) */
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("generation_run_idem_uq").on(t.projectId, t.idempotencyKey),
    index("generation_run_project_idx").on(t.projectId, t.createdAt),
  ],
);

export const stakeholder = pgTable(
  "stakeholder",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    roleName: text("role_name").notNull(),
    description: text("description").notNull().default(""),
    whyItMatters: text("why_it_matters").notNull().default(""),
    relevance: smallint("relevance").notNull().default(3),
    interviewPriority: interviewPriority("interview_priority").notNull().default("medium"),
    recruitmentCriteria: text("recruitment_criteria").notNull().default(""),
    interviewQuestions: text("interview_questions").array().notNull().default([]),
    expectedEvidence: text("expected_evidence").notNull().default(""),
    source: creationSource("source").notNull().default("ai_generated"),
    /** normalized role name, one role per project */
    dedupeKey: text("dedupe_key").notNull(),
    generationRunId: uuid("generation_run_id").references(() => generationRun.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("stakeholder_dedupe_uq").on(t.projectId, t.dedupeKey),
    unique("stakeholder_id_project_uq").on(t.id, t.projectId),
    check("stakeholder_relevance_chk", sql`${t.relevance} between 1 and 5`),
    index("stakeholder_project_idx").on(t.projectId),
  ],
);

export const assumption = pgTable(
  "assumption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** free text so categories can be extended; the app offers a standard list */
    category: text("category").notNull().default("problem_severity"),
    rationale: text("rationale").notNull().default(""),
    impact: smallint("impact").notNull(),
    uncertainty: smallint("uncertainty").notNull(),
    /** impact x uncertainty, computed by the database so it can never disagree with its inputs */
    risk: smallint("risk").generatedAlwaysAs(sql`impact * uncertainty`),
    confidence: smallint("confidence"),
    validationMethod: text("validation_method").notNull().default(""),
    validationQuestions: text("validation_questions").array().notNull().default([]),
    experimentDescription: text("experiment_description").notNull().default(""),
    successCriteria: text("success_criteria").notNull().default(""),
    status: validationStatus("status").notNull().default("generated"),
    source: creationSource("source").notNull().default("ai_generated"),
    /** true when the assumption leans on an audience the user has not confirmed */
    provisional: boolean("provisional").notNull().default(false),
    /** normalized title, one per project: makes regeneration idempotent */
    dedupeKey: text("dedupe_key").notNull(),
    generationRunId: uuid("generation_run_id").references(() => generationRun.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assumption_dedupe_uq").on(t.projectId, t.dedupeKey),
    unique("assumption_id_project_uq").on(t.id, t.projectId),
    check("assumption_impact_chk", sql`${t.impact} between 1 and 5`),
    check("assumption_uncertainty_chk", sql`${t.uncertainty} between 1 and 5`),
    check("assumption_confidence_chk", sql`${t.confidence} is null or ${t.confidence} between 0 and 100`),
    index("assumption_project_status_idx").on(t.projectId, t.status),
  ],
);

/** Many to many. Both ends are forced to belong to the same project by composite foreign keys. */
export const assumptionStakeholder = pgTable(
  "assumption_stakeholder",
  {
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    assumptionId: uuid("assumption_id").notNull(),
    stakeholderId: uuid("stakeholder_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.assumptionId, t.stakeholderId] }),
    foreignKey({ columns: [t.assumptionId, t.projectId], foreignColumns: [assumption.id, assumption.projectId] }).onDelete("cascade"),
    foreignKey({ columns: [t.stakeholderId, t.projectId], foreignColumns: [stakeholder.id, stakeholder.projectId] }).onDelete("cascade"),
    index("assumption_stakeholder_stakeholder_idx").on(t.stakeholderId),
  ],
);

/** Research results recorded by a person. Never created by the model. */
export const assumptionEvidence = pgTable(
  "assumption_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    assumptionId: uuid("assumption_id").notNull(),
    stakeholderId: uuid("stakeholder_id"),
    meetingId: uuid("meeting_id").references(() => meeting.id, { onDelete: "set null" }),
    type: evidenceType("type").notNull(),
    source: text("source").notNull().default(""),
    summary: text("summary").notNull(),
    interpretation: evidenceInterpretation("interpretation").notNull(),
    strength: evidenceStrength("strength").notNull().default("moderate"),
    researchedOn: date("researched_on").notNull(),
    reference: text("reference"),
    createdBy: uuid("created_by").references(() => appUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.assumptionId, t.projectId], foreignColumns: [assumption.id, assumption.projectId] }).onDelete("cascade"),
    foreignKey({ columns: [t.stakeholderId, t.projectId], foreignColumns: [stakeholder.id, stakeholder.projectId] }),
    index("assumption_evidence_assumption_idx").on(t.assumptionId),
    index("assumption_evidence_stakeholder_idx").on(t.stakeholderId),
  ],
);

/** Append-only log. The application offers no update or delete for these rows. */
export const assumptionDecision = pgTable(
  "assumption_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    assumptionId: uuid("assumption_id").notNull(),
    fromStatus: validationStatus("from_status").notNull(),
    toStatus: validationStatus("to_status").notNull(),
    rationale: text("rationale").notNull(),
    interpretation: text("interpretation"),
    evidenceIds: uuid("evidence_ids").array().notNull().default([]),
    actorId: uuid("actor_id").references(() => appUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.assumptionId, t.projectId], foreignColumns: [assumption.id, assumption.projectId] }).onDelete("cascade"),
    index("assumption_decision_assumption_idx").on(t.assumptionId, t.createdAt),
  ],
);

/** Question bank: interview guide in the five act structure (docs/SystemPrompts/rightQuestions.md). */
export const interviewGuide = pgTable(
  "interview_guide",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    stakeholderId: uuid("stakeholder_id"),
    title: text("title").notNull(),
    assumptionIds: uuid("assumption_ids").array().notNull().default([]),
    /** { acts: [{ act: 1..5, name, goal, questions: [{ text, assumptionId?, followUps[], ladder }] }], coachNotes: string[] } */
    content: jsonb("content").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ columns: [t.stakeholderId, t.projectId], foreignColumns: [stakeholder.id, stakeholder.projectId] }).onDelete("cascade"),
    index("interview_guide_project_idx").on(t.projectId),
  ],
);
