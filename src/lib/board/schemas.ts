import { z } from "zod";
import {
  EVIDENCE_TYPES,
  INTERPRETATIONS,
  PRIORITIES,
  STATUSES,
  STRENGTHS,
  isLeadingQuestion,
  looksLikeFabricatedEvidence,
  normalizeKey,
} from "./constants";

const score = z.number().int().min(1).max(5);
const short = (min: number, max: number) => z.string().trim().min(min).max(max);

/** A neutral question about past behavior. Hypothetical and leading wording is rejected. */
export const neutralQuestion = short(8, 300).refine((q) => !isLeadingQuestion(q), {
  message: "Question is hypothetical or leading. Ask about a specific past event instead (for example: Tell me about the last time ...).",
});

const factual = (min: number, max: number) =>
  short(min, max).refine((t) => !looksLikeFabricatedEvidence(t), {
    message: "Do not state statistics or research findings as facts. Describe the belief and how to test it.",
  });

const categoryText = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{2,39}$/, "category must be lowercase snake_case, 3 to 40 characters");

const localId = z.string().trim().min(1).max(20);

// ---------- model output: assumptions and stakeholders ----------

export const genAssumption = z.object({
  id: localId,
  title: short(8, 200),
  description: factual(10, 600),
  category: categoryText,
  rationale: factual(10, 600),
  impact: score,
  uncertainty: score,
  /** true when the belief depends on an audience the user has not confirmed */
  provisional: z.boolean().default(false),
  validationMethod: short(3, 200),
  validationQuestions: z.array(neutralQuestion).min(1).max(5),
  experimentDescription: short(10, 600),
  successCriteria: short(10, 500),
});

export const genStakeholder = z.object({
  id: localId,
  roleName: short(3, 120),
  description: short(10, 500),
  whyItMatters: short(10, 500),
  relevance: score,
  interviewPriority: z.enum(PRIORITIES),
  recruitmentCriteria: short(5, 500),
  interviewQuestions: z.array(neutralQuestion).min(1).max(6),
  expectedEvidence: short(5, 500),
});

const link = z.object({ assumptionId: localId, stakeholderId: localId });

export interface OutputContext {
  /** keys the prompt gave to stakeholders that already exist (for example e1, e2) */
  existingStakeholderKeys: string[];
  mode: "initial" | "refine";
}

/** Builds the validator for one generation. Cross-reference rules need the existing keys. */
export function generationOutputSchema(ctx: OutputContext) {
  const initial = ctx.mode === "initial";
  return z
    .object({
      stakeholders: z.array(genStakeholder).min(initial ? 2 : 0).max(6),
      assumptions: z.array(genAssumption).min(initial ? 5 : 0).max(12),
      assumptionStakeholderLinks: z.array(link).max(80),
      generationSummary: short(5, 600),
      /** refine only */
      suggestedChanges: z
        .array(z.object({ assumptionTitle: short(3, 200), field: z.enum(["description", "successCriteria", "validationMethod", "rationale"]), proposed: factual(5, 600), reason: short(5, 400) }))
        .max(10)
        .default([]),
      possiblyObsolete: z.array(z.object({ assumptionTitle: short(3, 200), reason: short(5, 400) })).max(10).default([]),
    })
    .superRefine((o, c) => {
      const aIds = new Set<string>();
      for (const a of o.assumptions) {
        if (aIds.has(a.id)) c.addIssue({ code: "custom", message: `Duplicate assumption id ${a.id}`, path: ["assumptions"] });
        aIds.add(a.id);
      }
      const sIds = new Set<string>();
      for (const s of o.stakeholders) {
        if (sIds.has(s.id) || ctx.existingStakeholderKeys.includes(s.id)) {
          c.addIssue({ code: "custom", message: `Duplicate stakeholder id ${s.id}`, path: ["stakeholders"] });
        }
        sIds.add(s.id);
      }
      const titles = new Set<string>();
      for (const a of o.assumptions) {
        const k = normalizeKey(a.title);
        if (titles.has(k)) c.addIssue({ code: "custom", message: `Duplicate assumption title: ${a.title}`, path: ["assumptions"] });
        titles.add(k);
      }
      const roles = new Set<string>();
      for (const s of o.stakeholders) {
        const k = normalizeKey(s.roleName);
        if (roles.has(k)) c.addIssue({ code: "custom", message: `Duplicate stakeholder role: ${s.roleName}`, path: ["stakeholders"] });
        roles.add(k);
      }
      const linked = new Set<string>();
      for (const l of o.assumptionStakeholderLinks) {
        if (!aIds.has(l.assumptionId)) c.addIssue({ code: "custom", message: `Link refers to unknown assumption ${l.assumptionId}`, path: ["assumptionStakeholderLinks"] });
        if (!sIds.has(l.stakeholderId) && !ctx.existingStakeholderKeys.includes(l.stakeholderId)) {
          c.addIssue({ code: "custom", message: `Link refers to unknown stakeholder ${l.stakeholderId}`, path: ["assumptionStakeholderLinks"] });
        }
        linked.add(l.assumptionId);
      }
      for (const a of o.assumptions) {
        if (!linked.has(a.id)) c.addIssue({ code: "custom", message: `Assumption ${a.id} has no stakeholder link`, path: ["assumptionStakeholderLinks"] });
      }
    });
}
export type GenerationOutput = z.infer<ReturnType<typeof generationOutputSchema>>;

export const audienceAnalysis = z.object({
  audienceStated: z.boolean(),
  statedAudience: short(3, 200).nullable().default(null),
  suggestions: z.array(short(3, 160)).min(2).max(6),
});

// ---------- model output: interview guide (five act structure) ----------

const ladder = z.enum(["context", "past_behavior", "specific_story", "playback", "open"]);
const guideQuestion = z.object({
  text: short(8, 300),
  /** key from the prompt (a1, a2 ...) for act 3 questions */
  assumptionId: localId.optional().nullable(),
  followUps: z.array(short(5, 250)).max(4).default([]),
  ladder,
});

const ACT_NAMES = [
  "Friendly Welcome and Context Setting",
  "Contextual Questions",
  "Core Questions and Deep Dive",
  "Wrap-up and Debrief",
  "Unknown Unknowns",
] as const;

export function guideOutputSchema(assumptionKeys: string[]) {
  return z
    .object({
      assumptionsToTest: z.array(z.object({ assumptionId: localId, whyItIsRisky: short(5, 300) })).min(1).max(5),
      acts: z.array(z.object({ act: z.number().int().min(1).max(5), name: short(3, 80), goal: short(5, 300), questions: z.array(guideQuestion).min(1).max(10) })).length(5),
      coachNotes: z.array(short(5, 300)).min(2).max(8),
    })
    .superRefine((g, c) => {
      g.acts.forEach((a, i) => {
        if (a.act !== i + 1) c.addIssue({ code: "custom", message: `Acts must be in order 1 to 5 (got ${a.act} at position ${i + 1})`, path: ["acts"] });
      });
      for (const a of g.assumptionsToTest) {
        if (!assumptionKeys.includes(a.assumptionId)) c.addIssue({ code: "custom", message: `Unknown assumption ${a.assumptionId}`, path: ["assumptionsToTest"] });
      }
      // Hypothetical wording is allowed only in the scripted welcome and wrap-up acts.
      g.acts.forEach((a) => {
        if (a.act === 2 || a.act === 3) {
          for (const q of a.questions) {
            if (isLeadingQuestion(q.text)) c.addIssue({ code: "custom", message: `Act ${a.act} question is hypothetical or leading: "${q.text}"`, path: ["acts"] });
          }
        }
      });
      const act3 = g.acts.find((a) => a.act === 3);
      for (const k of g.assumptionsToTest.map((x) => x.assumptionId)) {
        const n = act3?.questions.filter((q) => q.assumptionId === k).length ?? 0;
        if (n < 2) c.addIssue({ code: "custom", message: `Act 3 needs at least 2 different questions for assumption ${k} (triangulate)`, path: ["acts"] });
      }
    });
}
export type GuideOutput = z.infer<ReturnType<typeof guideOutputSchema>>;
export { ACT_NAMES };

// ---------- API inputs ----------

export const projectBasics = z.object({
  name: short(1, 120),
  idea: short(10, 4000),
});

export const audienceInput = z.object({
  state: z.enum(["confirmed", "skipped"]),
  value: short(3, 300).optional(),
});

export const generateInput = z.object({
  idempotencyKey: z.string().regex(/^[\w-]{8,64}$/),
});

export const REFINE_DIMENSIONS = [
  "customer_segments",
  "buying_behavior",
  "usage_environment",
  "pricing",
  "acquisition_channels",
  "competitors",
  "technical_constraints",
  "geography",
  "regulatory",
] as const;
export const REFINE_LABEL: Record<(typeof REFINE_DIMENSIONS)[number], string> = {
  customer_segments: "Target customer segments",
  buying_behavior: "Buying behavior",
  usage_environment: "Usage environment",
  pricing: "Pricing and willingness to pay",
  acquisition_channels: "Acquisition channels",
  competitors: "Competitors and alternatives",
  technical_constraints: "Technical constraints",
  geography: "Geography",
  regulatory: "Regulatory or compliance requirements",
};

export const refineInput = z.object({
  idempotencyKey: z.string().regex(/^[\w-]{8,64}$/),
  dimensions: z.array(z.enum(REFINE_DIMENSIONS)).min(1).max(REFINE_DIMENSIONS.length),
  notes: z.record(z.string(), short(0, 2000)).default({}),
});

export const assumptionCreate = z.object({
  title: short(8, 200),
  description: short(0, 600).default(""),
  category: categoryText.default("problem_severity"),
  rationale: short(0, 600).default(""),
  impact: score,
  uncertainty: score,
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  validationMethod: short(0, 200).default(""),
  validationQuestions: z.array(short(5, 300)).max(8).default([]),
  experimentDescription: short(0, 600).default(""),
  successCriteria: short(0, 500).default(""),
  stakeholderIds: z.array(z.string().uuid()).max(20).default([]),
});

/** Edit. Status, risk, source and ids are not editable here: status has its own endpoint and risk is computed. */
export const assumptionPatch = assumptionCreate.omit({ stakeholderIds: true }).partial();

export const stakeholderCreate = z.object({
  roleName: short(3, 120),
  description: short(0, 500).default(""),
  whyItMatters: short(0, 500).default(""),
  relevance: score.default(3),
  interviewPriority: z.enum(PRIORITIES).default("medium"),
  recruitmentCriteria: short(0, 500).default(""),
  interviewQuestions: z.array(short(5, 300)).max(10).default([]),
  expectedEvidence: short(0, 500).default(""),
  assumptionIds: z.array(z.string().uuid()).max(60).default([]),
});
export const stakeholderPatch = stakeholderCreate.omit({ assumptionIds: true }).partial();

export const linkSet = z.object({ ids: z.array(z.string().uuid()).max(60) });

export const evidenceCreate = z.object({
  stakeholderId: z.string().uuid().nullable().optional(),
  meetingId: z.string().uuid().nullable().optional(),
  type: z.enum(EVIDENCE_TYPES),
  source: short(0, 200).default(""),
  summary: short(10, 3000),
  interpretation: z.enum(INTERPRETATIONS),
  strength: z.enum(STRENGTHS).default("moderate"),
  researchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: short(0, 500).nullable().optional(),
});

export const moveInput = z.object({
  from: z.enum(STATUSES),
  to: z.enum(STATUSES),
  rationale: short(0, 2000).optional(),
  interpretation: short(0, 2000).optional(),
  evidenceIds: z.array(z.string().uuid()).max(50).optional(),
  confirm: z.boolean().optional(),
});

export const guideRequest = z.object({
  stakeholderId: z.string().uuid(),
});
