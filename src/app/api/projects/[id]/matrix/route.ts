import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { getProject } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getProject(id);
  const { assumption, meeting, link, evidence } = schema;
  const assumptions = await db().select().from(assumption).where(eq(assumption.projectId, id)).orderBy(asc(assumption.createdAt));
  const meetings = await db().select().from(meeting).where(eq(meeting.projectId, id)).orderBy(asc(meeting.createdAt));
  const rows = await db()
    .select({
      assumptionId: link.assumptionId,
      meetingId: evidence.meetingId,
      stance: link.stance,
      strength: link.strength,
    })
    .from(link)
    .innerJoin(evidence, eq(evidence.id, link.evidenceId))
    .innerJoin(assumption, eq(assumption.id, link.assumptionId))
    .where(and(eq(assumption.projectId, id), eq(link.rejected, false)));
  const cells: Record<string, { net: number; supports: number; contradicts: number }> = {};
  for (const r of rows) {
    if (r.stance === "neutral") continue;
    const k = `${r.assumptionId}:${r.meetingId}`;
    const c = (cells[k] ??= { net: 0, supports: 0, contradicts: 0 });
    if (r.stance === "supports") {
      c.net += r.strength;
      c.supports++;
    } else {
      c.net -= r.strength;
      c.contradicts++;
    }
  }
  return NextResponse.json({ assumptions, meetings, cells });
});
