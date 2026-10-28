import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assumptionPatch } from "@/lib/board/schemas";
import { normalizeKey } from "@/lib/board/constants";
import { requireProject } from "@/server/auth";
import { getAssumptionDetail, requireAssumption } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; aid: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { id, aid } = await ctx.params;
  await requireProject(req, id);
  return NextResponse.json(await getAssumptionDetail(id, aid));
});

/** Edits content only. Status moves through /move, and risk is computed from impact and uncertainty. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id, aid } = await ctx.params;
  await requireProject(req, id);
  await requireAssumption(id, aid);
  const v = await parseBody(req, assumptionPatch);
  const set: Record<string, unknown> = { ...v, updatedAt: new Date() };
  if (v.title !== undefined) set.dedupeKey = normalizeKey(v.title);
  try {
    await db().update(schema.assumption).set(set).where(and(eq(schema.assumption.id, aid), eq(schema.assumption.projectId, id)));
  } catch (e) {
    if (String((e as { message?: string }).message).includes("assumption_dedupe_uq") || (e as { code?: string }).code === "23505") {
      throw new ApiError(409, "duplicate", "Another assumption already has this title");
    }
    throw e;
  }
  return NextResponse.json(await getAssumptionDetail(id, aid));
});

/** Only an assumption nobody has touched can be deleted: no moves, no evidence. Anything else keeps its history. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { id, aid } = await ctx.params;
  await requireProject(req, id);
  const a = await requireAssumption(id, aid);
  const [{ n: evidence }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.assumptionEvidence).where(eq(schema.assumptionEvidence.assumptionId, aid));
  const [{ n: decisions }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.assumptionDecision).where(eq(schema.assumptionDecision.assumptionId, aid));
  if (a.status !== "generated" || evidence > 0 || decisions > 0) {
    throw new ApiError(409, "has_history", "This assumption has progress or history and cannot be deleted. Move it to Invalidated with a rationale instead.");
  }
  await db().delete(schema.assumption).where(eq(schema.assumption.id, aid));
  return NextResponse.json({ ok: true });
});
