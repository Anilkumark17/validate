import { z } from "zod";

const id = z.string().uuid();
const line = (max: number) => z.string().trim().min(1).max(max);
const METHODS = ["observation", "analytics", "prototype_test", "secondary_research", "missing_role"] as const;

export const assignOutput = (assumptionIds: string[], stakeholderIds: string[]) => {
  const assumption = new Set(assumptionIds);
  const stakeholder = new Set(stakeholderIds);
  return z
    .object({
      links: z.array(
        z.object({
          assumption_id: id,
          primary: id,
          secondary: id.nullable().optional(),
          score_primary: z.number().int().min(0).max(3),
          score_secondary: z.number().int().min(0).max(3).nullable().optional(),
          evidence_mode: z.enum(["interview", "observation", "analytics", "prototype_test", "secondary_research"]),
          round: z.enum(["round_1", "queued"]),
          reason: line(300),
          action: z.enum(["keep", "add", "remove_existing"]),
        }),
      ),
      no_fit: z.array(z.object({ assumption_id: id, reason: line(400), better_method: z.enum(METHODS) })),
      load: z.array(z.object({ stakeholder_id: id, primary_count: z.number().int().min(0), round_1_count: z.number().int().min(0), queued_count: z.number().int().min(0) })),
      missing_roles: z.array(z.object({ role: line(120), assumption_ids: z.array(id).max(40), reason: line(400) })).max(8),
      notes: z.array(line(400)).max(12),
    })
    .superRefine((out, c) => {
      const seen = new Set<string>();
      for (const link of out.links) {
        if (seen.has(link.assumption_id) || !assumption.has(link.assumption_id)) c.addIssue({ code: "custom", message: `Unknown or repeated assumption ${link.assumption_id}`, path: ["links"] });
        seen.add(link.assumption_id);
        if (!stakeholder.has(link.primary)) c.addIssue({ code: "custom", message: `Unknown stakeholder ${link.primary}`, path: ["links"] });
        if (link.secondary && (!stakeholder.has(link.secondary) || link.secondary === link.primary)) c.addIssue({ code: "custom", message: "Secondary must be a different known stakeholder", path: ["links"] });
      }
      for (const miss of out.no_fit) {
        if (seen.has(miss.assumption_id) || !assumption.has(miss.assumption_id)) c.addIssue({ code: "custom", message: `Unknown or repeated assumption ${miss.assumption_id}`, path: ["no_fit"] });
        seen.add(miss.assumption_id);
      }
      for (const id of assumptionIds) {
        if (!seen.has(id)) c.addIssue({ code: "custom", message: `Assumption ${id} is missing from the output`, path: ["links"] });
      }
      for (const row of out.load) {
        if (!stakeholder.has(row.stakeholder_id)) c.addIssue({ code: "custom", message: `Unknown stakeholder ${row.stakeholder_id}`, path: ["load"] });
      }
    });
};

export type AssignProposal = z.infer<ReturnType<typeof assignOutput>>;

export const assignApply = z.object({
  updates: z
    .array(z.object({ assumptionId: id, stakeholderIds: z.array(id).max(2) }))
    .max(40),
});
