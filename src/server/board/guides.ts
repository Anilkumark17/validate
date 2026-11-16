import { and, eq, sql } from "drizzle-orm";
import { guideOutputSchema, type GuideOutput } from "@/lib/board/schemas";
import { db, schema } from "../db";
import { ApiError } from "../http";
import { loadPromptProject } from "./generate";
import { GlmError, glmJson } from "./glm";
import { buildGuidePrompt } from "./prompts";
import { requireStakeholder } from "./queries";

const MAX_ASSUMPTIONS = 4;

/**
 * Question bank: builds a five act interview guide for one stakeholder role from its riskiest linked
 * assumptions, using the coaching prompt in docs/SystemPrompts/rightQuestions.md.
 */
async function draftGuide(projectId: string, stakeholderId: string, signal?: AbortSignal) {
  const s = await requireStakeholder(projectId, stakeholderId);
  const linked = await db()
    .select({ a: schema.assumption })
    .from(schema.assumptionStakeholder)
    .innerJoin(schema.assumption, eq(schema.assumption.id, schema.assumptionStakeholder.assumptionId))
    .where(eq(schema.assumptionStakeholder.stakeholderId, s.id))
    .orderBy(sql`${schema.assumption.risk} desc nulls last`)
    .limit(MAX_ASSUMPTIONS);
  if (linked.length === 0) throw new ApiError(409, "no_assumptions", "Link at least one assumption to this stakeholder before generating a guide");

  const keyed = linked.map((l, i) => ({ key: `a${i + 1}`, a: l.a }));
  const p = await loadPromptProject(projectId);
  const prompt = buildGuidePrompt({
    project: { name: p.name, idea: p.idea, audience: p.audience },
    stakeholder: { roleName: s.roleName, description: s.description, recruitmentCriteria: s.recruitmentCriteria },
    assumptions: keyed.map(({ key, a }) => ({ key, title: a.title, description: a.description, validationQuestions: a.validationQuestions })),
  });
  let out: { data: GuideOutput; model: string };
  try {
    out = await glmJson(guideOutputSchema(keyed.map((k) => k.key)), { system: prompt.system, user: prompt.user, maxTokens: 8000, signal });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  } catch (e) {
    if (e instanceof GlmError) throw new ApiError(502, "guide_failed", e.message);
    throw e;
  }
  const idOf = new Map(keyed.map((k) => [k.key, k.a.id]));
  const content = {
    ...out.data,
    assumptionsToTest: out.data.assumptionsToTest.map((x) => ({ ...x, assumptionId: idOf.get(x.assumptionId) ?? x.assumptionId })),
    acts: out.data.acts.map((act) => ({ ...act, questions: act.questions.map((q) => ({ ...q, assumptionId: q.assumptionId ? (idOf.get(q.assumptionId) ?? null) : null })) })),
  };
  return {
    projectId,
    stakeholderId: s.id,
    title: `Interview guide: ${s.roleName}`,
    assumptionIds: keyed.map((k) => k.a.id),
    content,
    model: out.model,
  };
}

/** Adds a guide. An older guide for the same role is left as it was. */
export async function createGuide(projectId: string, stakeholderId: string) {
  const values = await draftGuide(projectId, stakeholderId);
  const [row] = await db().insert(schema.interviewGuide).values(values).returning();
  return row!;
}

/** Writes one guide and removes the previous guides for that role in the same transaction. */
export async function replaceGuide(projectId: string, stakeholderId: string, signal?: AbortSignal) {
  const values = await draftGuide(projectId, stakeholderId, signal);
  if (signal?.aborted) return null;
  const [row] = await db().transaction(async (tx) => {
    await tx.delete(schema.interviewGuide).where(and(eq(schema.interviewGuide.projectId, projectId), eq(schema.interviewGuide.stakeholderId, stakeholderId)));
    return tx.insert(schema.interviewGuide).values(values).returning();
  });
  return row!;
}
