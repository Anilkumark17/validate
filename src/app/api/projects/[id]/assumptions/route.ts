import { NextResponse } from "next/server";
import { assumptionCreate } from "@/lib/board/schemas";
import { normalizeKey } from "@/lib/board/constants";
import { requireProject } from "@/server/auth";
import { assertStakeholdersInProject, getAssumptionDetail } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

/** User-created assumption. Starts as Generated like every other one; risk is computed by the database. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const { stakeholderIds, ...v } = await parseBody(req, assumptionCreate);
  const ids = await assertStakeholdersInProject(id, stakeholderIds);
  const created = await db().transaction(async (tx) => {
    const rows = await tx
      .insert(schema.assumption)
      .values({ ...v, confidence: v.confidence ?? null, projectId: id, status: "generated", source: "user_created", dedupeKey: normalizeKey(v.title) })
      .onConflictDoNothing({ target: [schema.assumption.projectId, schema.assumption.dedupeKey] })
      .returning({ id: schema.assumption.id });
    const row = rows[0];
    if (!row) throw new ApiError(409, "duplicate", "An assumption with this title already exists");
    if (ids.length) await tx.insert(schema.assumptionStakeholder).values(ids.map((sid) => ({ projectId: id, assumptionId: row.id, stakeholderId: sid })));
    return row.id;
  });
  return NextResponse.json(await getAssumptionDetail(id, created), { status: 201 });
});
