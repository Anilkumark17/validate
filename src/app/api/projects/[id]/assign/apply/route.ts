import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assignApply } from "@/lib/board/assign";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";

/** Writes the links the person confirmed. Does not change assumption text, status, or evidence. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "assign_apply", 20);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, assignApply);
  const chosen = new Map(v.updates.map((u) => [u.assumptionId, [...new Set(u.stakeholderIds)].slice(0, 2)]));
  const assumptionIds = [...chosen.keys()];
  const stakeholderIds = [...new Set([...chosen.values()].flat())];
  const [assumptions, stakeholders] = await Promise.all([
    assumptionIds.length ? db().select({ id: schema.assumption.id }).from(schema.assumption).where(eq(schema.assumption.projectId, id)) : Promise.resolve([]),
    stakeholderIds.length ? db().select({ id: schema.stakeholder.id }).from(schema.stakeholder).where(eq(schema.stakeholder.projectId, id)) : Promise.resolve([]),
  ]);
  const knownA = new Set(assumptions.map((a) => a.id));
  const knownS = new Set(stakeholders.map((s) => s.id));
  if (assumptionIds.some((aid) => !knownA.has(aid)) || stakeholderIds.some((sid) => !knownS.has(sid))) {
    throw new ApiError(400, "unknown_id", "A link refers to an assumption or stakeholder that is not in this project");
  }
  await db().transaction(async (tx) => {
    if (assumptionIds.length) await tx.delete(schema.assumptionStakeholder).where(inArray(schema.assumptionStakeholder.assumptionId, assumptionIds));
    const rows = [...chosen].flatMap(([assumptionId, ids]) => ids.map((stakeholderId) => ({ projectId: id, assumptionId, stakeholderId })));
    if (rows.length) await tx.insert(schema.assumptionStakeholder).values(rows);
  });
  return NextResponse.json({ updated: assumptionIds.length });
});
