import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { getMeeting, getProject } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const meeting = await getMeeting(id);
  const project = await getProject(meeting.projectId);
  const { segment, evidence, link, assumption, statusEvent } = schema;
  const segments = await db().select().from(segment).where(eq(segment.meetingId, id)).orderBy(asc(segment.idx));
  const evidenceRows = await db().select().from(evidence).where(eq(evidence.meetingId, id)).orderBy(asc(evidence.createdAt));
  const links = evidenceRows.length
    ? await db()
        .select()
        .from(link)
        .where(inArray(link.evidenceId, evidenceRows.map((e) => e.id)))
    : [];
  const assumptions = await db().select().from(assumption).where(eq(assumption.projectId, meeting.projectId)).orderBy(asc(assumption.createdAt));
  const events = await db().select().from(statusEvent).where(eq(statusEvent.meetingId, id)).orderBy(asc(statusEvent.createdAt));
  return NextResponse.json({ meeting, project, segments, evidence: evidenceRows, links, assumptions, events });
});
