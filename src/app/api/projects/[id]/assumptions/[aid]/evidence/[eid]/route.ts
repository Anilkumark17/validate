import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { requireAssumption } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, isUuid, notFound } from "@/server/http";

export const dynamic = "force-dynamic";

/** Evidence that a decision rests on cannot be deleted, so the decision history stays explainable. */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string; aid: string; eid: string }> }) => {
  const { id, aid, eid } = await ctx.params;
  await requireProject(req, id);
  await requireAssumption(id, aid);
  if (!isUuid(eid)) throw notFound("Evidence");
  const [used] = await db()
    .select({ id: schema.assumptionDecision.id })
    .from(schema.assumptionDecision)
    .where(and(eq(schema.assumptionDecision.assumptionId, aid), sql`${eid}::uuid = any(${schema.assumptionDecision.evidenceIds})`))
    .limit(1);
  if (used) throw new ApiError(409, "evidence_in_use", "A recorded decision rests on this evidence, so it cannot be deleted");
  const rows = await db()
    .delete(schema.assumptionEvidence)
    .where(and(eq(schema.assumptionEvidence.id, eid), eq(schema.assumptionEvidence.assumptionId, aid)))
    .returning({ id: schema.assumptionEvidence.id });
  if (rows.length === 0) throw notFound("Evidence");
  return NextResponse.json({ ok: true });
});
