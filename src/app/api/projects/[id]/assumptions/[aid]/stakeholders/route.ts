import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { linkSet } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { assertStakeholdersInProject, getAssumptionDetail, requireAssumption } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

/** Replaces the set of stakeholder roles linked to this assumption. Duplicates are impossible (composite key). */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) => {
  const { id, aid } = await ctx.params;
  await requireProject(req, id);
  await requireAssumption(id, aid);
  const v = await parseBody(req, linkSet);
  const ids = await assertStakeholdersInProject(id, v.ids);
  await db().transaction(async (tx) => {
    await tx.delete(schema.assumptionStakeholder).where(eq(schema.assumptionStakeholder.assumptionId, aid));
    if (ids.length) await tx.insert(schema.assumptionStakeholder).values(ids.map((sid) => ({ projectId: id, assumptionId: aid, stakeholderId: sid })));
  });
  return NextResponse.json(await getAssumptionDetail(id, aid));
});
