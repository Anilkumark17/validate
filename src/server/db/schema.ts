import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const assumptionType = pgEnum("assumption_type", ["desirability", "feasibility", "viability"]);
export const assumptionStatus = pgEnum("assumption_status", [
  "untested",
  "supporting",
  "contradicted",
  "mixed",
  "validated",
  "invalidated",
]);
export const evidenceStance = pgEnum("evidence_stance", ["supports", "contradicts", "neutral"]);
export const meetingSource = pgEnum("meeting_source", ["live_call", "transcript_upload", "manual"]);
export const linkOrigin = pgEnum("link_origin", ["model", "user"]);
export const jobStatus = pgEnum("job_status", ["queued", "processing", "done", "failed"]);
export const meetingState = pgEnum("meeting_state", ["scheduled", "live", "ended"]);

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
  persona: jsonb("persona"),
  personaUpdatedAt: timestamp("persona_updated_at", { withTimezone: true }),
  voice: jsonb("voice"),
  voiceUpdatedAt: timestamp("voice_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assumption = pgTable(
  "assumption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    type: assumptionType("type").notNull(),
    risk: smallint("risk").notNull().default(3),
    owner: text("owner"),
    status: assumptionStatus("status").notNull().default("untested"),
    confidence: real("confidence").notNull().default(0),
    /** Idea mapper extras: category, origin, evidence level, falsifiedIf, leapOfFaith, test plan. */
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assumption_project_idx").on(t.projectId)],
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

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id").notNull().references(() => meeting.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segment.id, { onDelete: "set null" }),
    imageUrl: text("image_url"),
    claim: text("claim").notNull(),
    quote: text("quote"),
    speaker: text("speaker"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_meeting_idx").on(t.meetingId)],
);

export const link = pgTable(
  "link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
    assumptionId: uuid("assumption_id").notNull().references(() => assumption.id, { onDelete: "cascade" }),
    stance: evidenceStance("stance").notNull(),
    strength: smallint("strength").notNull().default(2),
    rationale: text("rationale"),
    origin: linkOrigin("origin").notNull().default("model"),
    rejected: boolean("rejected").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("link_evidence_assumption_uq").on(t.evidenceId, t.assumptionId), index("link_assumption_idx").on(t.assumptionId)],
);

export const factKind = pgEnum("fact_kind", ["behavior", "pain", "goal", "language", "constraint", "tone"]);

/** Observed customer behavior and language, stored as testable facts for outbound. */
export const fact = pgTable(
  "fact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => project.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id").notNull().references(() => meeting.id, { onDelete: "cascade" }),
    segmentId: uuid("segment_id").references(() => segment.id, { onDelete: "set null" }),
    kind: factKind("kind").notNull(),
    statement: text("statement").notNull(),
    quote: text("quote"),
    speaker: text("speaker"),
    /** Customer's own words worth reusing in copy. */
    phrases: text("phrases").array().notNull().default([]),
    /** Cheap outbound test for this fact (message, offer, or question). */
    outboundTest: text("outbound_test"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fact_project_idx").on(t.projectId)],
);

export const statusEvent = pgTable(
  "status_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assumptionId: uuid("assumption_id").notNull().references(() => assumption.id, { onDelete: "cascade" }),
    meetingId: uuid("meeting_id").references(() => meeting.id, { onDelete: "set null" }),
    fromStatus: assumptionStatus("from_status"),
    toStatus: assumptionStatus("to_status").notNull(),
    confidence: real("confidence").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("status_event_assumption_idx").on(t.assumptionId, t.createdAt)],
);
