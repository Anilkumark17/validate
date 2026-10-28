import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { normalizeKey } from "@/lib/board/constants";
import { stakeholderPatch } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { requireStakeholder } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; sid: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id, sid } = await ctx.params;
  await requireProject(req, id);
  await requireStakeholder(id, sid);
  const v = await parseBody(req, stakeholderPatch);
  const set: Record<string, unknown> = { ...v, updatedAt: new Date() };
  if (v.roleName !== undefined) set.dedupeKey = normalizeKey(v.roleName);
  try {
    const [row] = await db()
      .update(schema.stakeholder)
      .set(set)
      .where(and(eq(schema.stakeholder.id, sid), eq(schema.stakeholder.projectId, id)))
      .returning();
    return NextResponse.json(row);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ApiError(409, "duplicate", "Another stakeholder already has this role name");
    throw e;
  }
});

/** A role with recorded evidence cannot be removed; unlink it from assumptions instead. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { id, sid } = await ctx.params;
  await requireProject(req, id);
  await requireStakeholder(id, sid);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.assumptionEvidence).where(eq(schema.assumptionEvidence.stakeholderId, sid));
  if (n > 0) throw new ApiError(409, "has_evidence", "Evidence is recorded for this stakeholder, so it cannot be removed.");
  await db().delete(schema.stakeholder).where(eq(schema.stakeholder.id, sid));
  return NextResponse.json({ ok: true });
});
