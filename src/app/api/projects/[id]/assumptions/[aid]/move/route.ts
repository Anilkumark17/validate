import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { STATUS_LABEL } from "@/lib/board/constants";
import { moveInput } from "@/lib/board/schemas";
import { checkMove } from "@/lib/board/transitions";
import { requireProject } from "@/server/auth";
import { getAssumptionDetail, requireAssumption } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; aid: string }> };

/**
 * The only way a status changes. Rules live in lib/board/transitions.ts and run here for every
 * request, so a client that skips the UI is held to the same rules. The row is locked, the
 * expected current status is checked, and the decision record is written in the same transaction.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  rateLimit(req, "move", 120);
  const { id, aid } = await ctx.params;
  const { user } = await requireProject(req, id);
  await requireAssumption(id, aid);
  const v = await parseBody(req, moveInput);

  await db().transaction(async (tx) => {
    const [a] = await tx
      .select({ status: schema.assumption.status })
      .from(schema.assumption)
      .where(and(eq(schema.assumption.id, aid), eq(schema.assumption.projectId, id)))
      .for("update");
    if (!a) throw new ApiError(404, "not_found", "Assumption not found");
    if (a.status !== v.from) {
      throw new ApiError(409, "status_changed", `The assumption is now ${STATUS_LABEL[a.status]}. Refresh and try again.`);
    }
    const evidence = await tx
      .select({ id: schema.assumptionEvidence.id, interpretation: schema.assumptionEvidence.interpretation })
      .from(schema.assumptionEvidence)
      .where(eq(schema.assumptionEvidence.assumptionId, aid));
    const check = checkMove({ from: a.status, to: v.to, rationale: v.rationale, interpretation: v.interpretation, evidenceIds: v.evidenceIds, confirm: v.confirm }, evidence);
    if (!check.ok) {
      const status = check.code === "invalid_transition" || check.code === "no_change" ? 400 : 422;
      throw new ApiError(status, check.code, check.recommend ? `${check.message} Recommended status: ${STATUS_LABEL[check.recommend]}.` : check.message);
    }
    await tx.update(schema.assumption).set({ status: v.to, updatedAt: new Date() }).where(eq(schema.assumption.id, aid));
    await tx.insert(schema.assumptionDecision).values({
      projectId: id,
      assumptionId: aid,
      fromStatus: a.status,
      toStatus: v.to,
      rationale: (v.rationale ?? "").trim() || `Moved from ${STATUS_LABEL[a.status]} to ${STATUS_LABEL[v.to]}`,
      interpretation: (v.interpretation ?? "").trim() || null,
      evidenceIds: v.evidenceIds ?? [],
      actorId: user.id,
    });
  });
  return NextResponse.json(await getAssumptionDetail(id, aid));
});
