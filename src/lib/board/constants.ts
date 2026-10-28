/** Shared (client and server) constants and pure helpers for the assumption board. */

export const STATUSES = [
  "generated",
  "ready_to_validate",
  "validation_in_progress",
  "evidence_collected",
  "validated",
  "invalidated",
  "needs_more_evidence",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  generated: "Generated",
  ready_to_validate: "Ready to Validate",
  validation_in_progress: "Validation in Progress",
  evidence_collected: "Evidence Collected",
  validated: "Validated",
  invalidated: "Invalidated",
  needs_more_evidence: "Needs More Evidence",
};

/** Only these two count as complete. */
export const COMPLETE_STATUSES: readonly Status[] = ["validated", "invalidated"];

/** Standard categories. The column is free text, so this list can grow without a migration. */
export const CATEGORIES = [
  "problem_severity",
  "customer_desirability",
  "usability",
  "willingness_to_pay",
  "acquisition",
  "retention",
  "technical_feasibility",
  "business_viability",
  "operational_feasibility",
  "regulatory_compliance",
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  problem_severity: "Problem severity",
  customer_desirability: "Customer desirability",
  usability: "Usability",
  willingness_to_pay: "Willingness to pay",
  acquisition: "Acquisition",
  retention: "Retention",
  technical_feasibility: "Technical feasibility",
  business_viability: "Business viability",
  operational_feasibility: "Operational feasibility",
  regulatory_compliance: "Regulatory or compliance",
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase());
}

export const EVIDENCE_TYPES = ["interview", "survey", "prototype_test", "experiment", "analytics", "observation", "secondary_research"] as const;
export const EVIDENCE_TYPE_LABEL: Record<(typeof EVIDENCE_TYPES)[number], string> = {
  interview: "Interview",
  survey: "Survey",
  prototype_test: "Prototype test",
  experiment: "Experiment",
  analytics: "Analytics",
  observation: "Observation",
  secondary_research: "Secondary research",
};
export const INTERPRETATIONS = ["supports", "contradicts", "inconclusive"] as const;
export const STRENGTHS = ["weak", "moderate", "strong"] as const;
export const PRIORITIES = ["high", "medium", "low"] as const;

export const AUDIENCE_STATES = ["unknown", "detected", "confirmed", "skipped"] as const;
export type AudienceState = (typeof AUDIENCE_STATES)[number];

/** A stakeholder role with linked assumptions and fewer interviews than this is flagged. */
export const MIN_INTERVIEWS_PER_STAKEHOLDER = 5;

/** Risk = impact x uncertainty, 1 to 25. The database computes the stored value; this mirrors it for the client. */
export const riskOf = (impact: number, uncertainty: number) => impact * uncertainty;

export type RiskBucket = "high" | "medium" | "low";
export const riskBucket = (risk: number): RiskBucket => (risk >= 15 ? "high" : risk >= 8 ? "medium" : "low");

export interface ProgressCounts {
  total: number;
  validated: number;
  invalidated: number;
  inProgress: number;
  awaiting: number;
  needsMoreEvidence: number;
  evidenceCollected: number;
  percent: number;
}

/**
 * Progress = (validated + invalidated) / total * 100, derived from status counts every time.
 * In progress, evidence collected and needs more evidence are incomplete.
 */
export function computeProgress(byStatus: Partial<Record<Status, number>>): ProgressCounts {
  const n = (s: Status) => byStatus[s] ?? 0;
  const total = STATUSES.reduce((sum, s) => sum + n(s), 0);
  const done = n("validated") + n("invalidated");
  return {
    total,
    validated: n("validated"),
    invalidated: n("invalidated"),
    inProgress: n("validation_in_progress"),
    awaiting: n("generated") + n("ready_to_validate"),
    needsMoreEvidence: n("needs_more_evidence"),
    evidenceCollected: n("evidence_collected"),
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/** Normalized key used to keep one assumption or role per project. */
export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["the", "a", "an", "to", "of", "in", "for", "and", "or", "will", "are", "is", "on", "with", "that", "their", "they", "be", "it", "this", "as", "at", "by"]);
const tokens = (t: string) => new Set(normalizeKey(t).split(" ").filter((w) => w && !STOP.has(w)));

/** Jaccard similarity of significant words. Catches reworded repeats of the same assumption. */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export const NEAR_DUPLICATE = 0.8;

const HYPOTHETICAL = [
  /\bwould you\b/i,
  /\bwill you\b/i,
  /\bdo you think\b/i,
  /\bhow likely\b/i,
  /\bhow much would\b/i,
  /\bif we (built|made|had|offered|added|created)\b/i,
  /\bimagine\b/i,
  /\bhypothetical/i,
  /\bwouldn'?t you\b/i,
  /\bdon'?t you (think|agree|feel)\b/i,
  /\bisn'?t it\b/i,
  /\bdo you (like|want|love|prefer)\b/i,
  /\bare you interested\b/i,
  /\bwould it be\b/i,
  /\bis this (useful|helpful|a good idea)\b/i,
  /\bwould that\b/i,
];

/** True for hypothetical, opinion-seeking or leading questions that the interview framework rules out. */
export function isLeadingQuestion(q: string): boolean {
  return HYPOTHETICAL.some((re) => re.test(q));
}

const FABRICATED = [
  /\b\d{1,3}(\.\d+)?\s?%\s+of\b/i,
  /\b(studies|research|surveys?|reports?)\s+(show|shows|found|indicate|suggest)\b/i,
  /\baccording to (a|the|recent)\b/i,
  /\b(our|the) (interviews|survey|research|users) (showed|found|confirmed|revealed)\b/i,
];

/** Guards against model text that states unsupported statistics or research findings as fact. */
export function looksLikeFabricatedEvidence(text: string): boolean {
  return FABRICATED.some((re) => re.test(text));
}
