import { NextResponse } from "next/server";
import { normalizeKey } from "@/lib/board/constants";
import { stakeholderCreate } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { assertAssumptionsInProject } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

/** A stakeholder is a ROLE (for example "parents who plan meals"), never a named person. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const { assumptionIds, ...v } = await parseBody(req, stakeholderCreate);
  const ids = await assertAssumptionsInProject(id, assumptionIds);
  const row = await db().transaction(async (tx) => {
    const rows = await tx
      .insert(schema.stakeholder)
      .values({ ...v, projectId: id, source: "user_created", dedupeKey: normalizeKey(v.roleName) })
      .onConflictDoNothing({ target: [schema.stakeholder.projectId, schema.stakeholder.dedupeKey] })
      .returning();
    const s = rows[0];
    if (!s) throw new ApiError(409, "duplicate", "This stakeholder role already exists");
    if (ids.length) await tx.insert(schema.assumptionStakeholder).values(ids.map((aid) => ({ projectId: id, assumptionId: aid, stakeholderId: s.id })));
    return s;
  });
  return NextResponse.json(row, { status: 201 });
});
