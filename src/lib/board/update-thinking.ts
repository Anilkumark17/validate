import { z } from "zod";
import { isLeadingQuestion, looksLikeFabricatedEvidence } from "./constants";

const score = z.number().int().min(1).max(5);
const line = (max: number) => z.string().trim().min(1).max(max);
const optionalLine = (max: number) => z.string().trim().max(max);

export const UPDATE_GAPS = [
  "project_drift",
  "audience_mismatch",
  "conflicts_with_assumption",
  "conflicts_with_evidence",
  "no_segment",
  "no_behaviour",
  "no_basis",
  "no_test",
  "no_decision",
  "bundled",
] as const;

const LEADING_ASK = /\b(would you|do you think|do you feel|don'?t you)\b/i;

export const refinedAssumption = z
  .object({
    title: z.string().trim().min(8).max(200),
    statement: z.string().trim().min(10).max(500),
    segment: optionalLine(160),
    decision_informed: optionalLine(400),
    validation_method: optionalLine(200),
    success_criterion: optionalLine(400),
    kill_criterion: optionalLine(400),
    impact: score,
    uncertainty: score,
    score_reason: optionalLine(400),
  })
  .superRefine((r, c) => {
    if (looksLikeFabricatedEvidence(`${r.statement} ${r.score_reason}`)) {
      c.addIssue({ code: "custom", message: "Do not invent statistics or research findings", path: ["statement"] });
    }
  });

export type RefinedAssumption = z.infer<typeof refinedAssumption>;

export const updateTurnOutput = z.union([
  z.object({
    route: z.enum(["evidence", "note"]),
    message: line(400),
  }),
  z
    .object({
      done: z.literal(false),
      gap: z.enum(UPDATE_GAPS),
      quoted: line(400),
      why: line(300),
      question: line(400),
      asked: z.number().int().min(1).max(3),
    })
    .superRefine((q, c) => {
      if (LEADING_ASK.test(q.question) || isLeadingQuestion(q.question)) {
        c.addIssue({ code: "custom", message: "Ask about what they saw or did. Do not use would you, do you think, or a leading question.", path: ["question"] });
      }
    }),
  z.object({
    done: z.literal(true),
    refined: refinedAssumption,
    split_into: z.array(refinedAssumption).max(2).default([]),
    changes: z.array(line(300)).max(12),
    unresolved_gaps: z.array(z.enum(UPDATE_GAPS)).max(8),
    asked: z.number().int().min(0).max(3),
  }),
]);

export type UpdateTurn = z.infer<typeof updateTurnOutput>;

/** Maps a proposed rewrite onto the columns an assumption already has. Does not touch status or evidence. */
export function toAssumptionFields(r: RefinedAssumption) {
  const who = r.segment.trim();
  const statement = r.statement.trim();
  const description = (who && !statement.toLowerCase().includes(who.toLowerCase()) ? `${statement}\n\nWho: ${who}` : statement).slice(0, 600);
  const rationale = [r.decision_informed.trim() && `If this is true or false: ${r.decision_informed.trim()}`, r.score_reason.trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 600);
  const successCriteria = [r.success_criterion.trim(), r.kill_criterion.trim() && `Kill: ${r.kill_criterion.trim()}`].filter(Boolean).join("\n").slice(0, 500);
  return {
    title: r.title.trim().slice(0, 200),
    description,
    rationale,
    validationMethod: r.validation_method.trim().slice(0, 200),
    successCriteria,
    impact: r.impact,
    uncertainty: r.uncertainty,
  };
}
