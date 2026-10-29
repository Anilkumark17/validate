import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { assertCanCreateMeeting } from "@/server/limits";
import { createMeeting } from "@/server/queries";
import { meetingInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const rows = await db()
    .select()
    .from(schema.meeting)
    .where(eq(schema.meeting.projectId, id))
    .orderBy(desc(schema.meeting.createdAt));
  return NextResponse.json(rows);
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { user } = await requireProject(req, id);
  const v = await parseBody(req, meetingInput);
  await assertCanCreateMeeting(user);
  const m = await createMeeting(id, {
    title: v.title,
    scheduledFor: v.scheduledFor ? new Date(v.scheduledFor) : null,
    source: "live_call",
    state: "scheduled",
  });
  return NextResponse.json(m, { status: 201 });
});
