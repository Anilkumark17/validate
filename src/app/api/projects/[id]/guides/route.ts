import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guideOutputSchema, guideRequest, type GuideOutput } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { GlmError, glmJson } from "@/server/board/glm";
import { loadPromptProject } from "@/server/board/generate";
import { buildGuidePrompt } from "@/server/board/prompts";
import { requireStakeholder } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_ASSUMPTIONS = 4;

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const rows = await db().select().from(schema.interviewGuide).where(eq(schema.interviewGuide.projectId, id)).orderBy(desc(schema.interviewGuide.createdAt));
  return NextResponse.json(rows);
});

/**
 * Question bank: builds a five act interview guide for one stakeholder role from its riskiest linked
 * assumptions, using the coaching prompt in docs/SystemPrompts/rightQuestions.md.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "guide", 10);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, guideRequest);
  const s = await requireStakeholder(id, v.stakeholderId);
  const linked = await db()
    .select({ a: schema.assumption })
    .from(schema.assumptionStakeholder)
    .innerJoin(schema.assumption, eq(schema.assumption.id, schema.assumptionStakeholder.assumptionId))
    .where(eq(schema.assumptionStakeholder.stakeholderId, s.id))
    .orderBy(sql`${schema.assumption.risk} desc nulls last`)
    .limit(MAX_ASSUMPTIONS);
  if (linked.length === 0) throw new ApiError(409, "no_assumptions", "Link at least one assumption to this stakeholder before generating a guide");

  const keyed = linked.map((l, i) => ({ key: `a${i + 1}`, a: l.a }));
  const p = await loadPromptProject(id);
  const prompt = buildGuidePrompt({
    project: { name: p.name, idea: p.idea, audience: p.audience },
    stakeholder: { roleName: s.roleName, description: s.description, recruitmentCriteria: s.recruitmentCriteria },
    assumptions: keyed.map(({ key, a }) => ({ key, title: a.title, description: a.description, validationQuestions: a.validationQuestions })),
  });
  let out: { data: GuideOutput; model: string };
  try {
    out = await glmJson(guideOutputSchema(keyed.map((k) => k.key)), { system: prompt.system, user: prompt.user, maxTokens: 8000 });
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
  const [row] = await db()
    .insert(schema.interviewGuide)
    .values({
      projectId: id,
      stakeholderId: s.id,
      title: `Interview guide: ${s.roleName}`,
      assumptionIds: keyed.map((k) => k.a.id),
      content,
      model: out.model,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
});
