import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { getProject } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getProject(id);
  const { fact, meeting } = schema;
  const rows = await db()
    .select({
      id: fact.id,
      kind: fact.kind,
      statement: fact.statement,
      quote: fact.quote,
      speaker: fact.speaker,
      phrases: fact.phrases,
      outboundTest: fact.outboundTest,
      meetingId: fact.meetingId,
      meetingTitle: meeting.title,
      createdAt: fact.createdAt,
    })
    .from(fact)
    .innerJoin(meeting, eq(meeting.id, fact.meetingId))
    .where(eq(fact.projectId, id))
    .orderBy(desc(fact.createdAt))
    .limit(300);
  return NextResponse.json(rows);
});
