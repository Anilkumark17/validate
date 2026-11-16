import { z } from "zod";
import { isLeadingQuestion } from "./constants";

const line = (max: number) => z.string().trim().min(1).max(max);
const LEADING_ASK = /\b(would you|do you think|do you feel|don'?t you)\b/i;

export const REFINE_GAPS = ["project_drift", "missing_aspect"] as const;

export const refineCheckOutput = z.union([
  z
    .object({
      done: z.literal(false),
      gap: z.enum(REFINE_GAPS),
      quoted: line(400),
      why: line(300),
      question: line(400),
      asked: z.number().int().min(1).max(2),
    })
    .superRefine((q, c) => {
      if (LEADING_ASK.test(q.question) || isLeadingQuestion(q.question)) {
        c.addIssue({ code: "custom", message: "Ask about what they saw or did. Do not use would you, do you think, or a leading question.", path: ["question"] });
      }
    }),
  z.object({
    done: z.literal(true),
    asked: z.number().int().min(0).max(2),
  }),
]);

export type RefineCheck = z.infer<typeof refineCheckOutput>;
