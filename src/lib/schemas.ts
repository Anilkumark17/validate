import { z } from "zod";

export const ASSUMPTION_TYPES = ["desirability", "feasibility", "viability"] as const;
export const ASSUMPTION_STATUSES = ["untested", "supporting", "mixed", "contradicted", "validated", "invalidated"] as const;
export const STANCES = ["supports", "contradicts", "neutral"] as const;

export type AssumptionType = (typeof ASSUMPTION_TYPES)[number];
export type AssumptionStatus = (typeof ASSUMPTION_STATUSES)[number];
export type Stance = (typeof STANCES)[number];

export const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  targetUser: z.string().trim().max(300).optional().nullable(),
});

export const assumptionInput = z.object({
  statement: z.string().trim().min(3).max(500),
  type: z.enum(ASSUMPTION_TYPES),
  risk: z.number().int().min(1).max(5).default(3),
  owner: z.string().trim().max(120).optional().nullable(),
  meta: z.record(z.string(), z.unknown()).optional().nullable(),
});
export const assumptionPatch = assumptionInput.partial();

export const meetingInput = z.object({
  title: z.string().trim().min(1).max(160),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export const segmentInput = z.object({
  speaker: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(4000),
  startSec: z.number().min(0).optional().nullable(),
});

export const linkPatch = z.object({
  stance: z.enum(STANCES).optional(),
  strength: z.number().int().min(1).max(3).optional(),
  rejected: z.boolean().optional(),
});

export const tokenInput = z.object({
  meetingId: z.string().uuid().optional(),
  inviteCode: z.string().min(4).optional(),
  name: z.string().trim().min(1).max(60),
});

export const importInput = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().min(1).max(400_000),
});
