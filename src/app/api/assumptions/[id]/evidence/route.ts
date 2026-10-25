import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle, isUuid, notFound } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw notFound("Assumption");
  const { assumption, link, evidence, segment, meeting, statusEvent } = schema;
  const [a] = await db().select().from(assumption).where(eq(assumption.id, id));
  if (!a) throw notFound("Assumption");
  const links = await db()
    .select({
      id: link.id,
      stance: link.stance,
      strength: link.strength,
      rationale: link.rationale,
      origin: link.origin,
      rejected: link.rejected,
      claim: evidence.claim,
      quote: evidence.quote,
      speaker: evidence.speaker,
      imageUrl: evidence.imageUrl,
      startSec: segment.startSec,
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      createdAt: link.createdAt,
    })
    .from(link)
    .innerJoin(evidence, eq(evidence.id, link.evidenceId))
    .innerJoin(meeting, eq(meeting.id, evidence.meetingId))
    .leftJoin(segment, eq(segment.id, evidence.segmentId))
    .where(eq(link.assumptionId, id))
    .orderBy(asc(meeting.createdAt), asc(segment.idx));
  const history = await db()
    .select()
    .from(statusEvent)
    .where(eq(statusEvent.assumptionId, id))
    .orderBy(desc(statusEvent.createdAt));
  return NextResponse.json({ assumption: a, links, history });
});
