import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { evidenceCreate } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { assertStakeholdersInProject, getAssumptionDetail, requireAssumption } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

/** Evidence is recorded by a person. Nothing here comes from the model. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) => {
  const { id, aid } = await ctx.params;
  const { user } = await requireProject(req, id);
  await requireAssumption(id, aid);
  const v = await parseBody(req, evidenceCreate);
  const today = new Date();
  today.setDate(today.getDate() + 1);
  if (Number.isNaN(Date.parse(v.researchedOn)) || new Date(v.researchedOn) > today) {
    throw new ApiError(400, "bad_date", "Research date must be a real date, not in the future");
  }
  if (v.stakeholderId) await assertStakeholdersInProject(id, [v.stakeholderId]);
  if (v.meetingId) {
    const [m] = await db().select({ id: schema.meeting.id }).from(schema.meeting).where(and(eq(schema.meeting.id, v.meetingId), eq(schema.meeting.projectId, id)));
    if (!m) throw new ApiError(400, "bad_meeting", "The meeting does not belong to this project");
  }
  await db().insert(schema.assumptionEvidence).values({
    projectId: id,
    assumptionId: aid,
    stakeholderId: v.stakeholderId ?? null,
    meetingId: v.meetingId ?? null,
    type: v.type,
    source: v.source,
    summary: v.summary,
    interpretation: v.interpretation,
    strength: v.strength,
    researchedOn: v.researchedOn,
    reference: v.reference ?? null,
    createdBy: user.id,
  });
  return NextResponse.json(await getAssumptionDetail(id, aid), { status: 201 });
});
