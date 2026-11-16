import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireMeetingHost } from "@/server/auth";
import { db } from "@/server/db";
import { generationRun, insight, segment } from "@/server/db/schema";
import { handle, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";

/** Stored insights for this meeting, with the original lines beside the English quote. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  rateLimit(req, "meeting_insights", 60);
  await requireMeetingHost(req, id);
  const [insights, runs] = await Promise.all([
    db().select().from(insight).where(eq(insight.meetingId, id)).orderBy(desc(insight.importance), desc(insight.createdAt)),
    db()
      .select()
      .from(generationRun)
      .where(and(eq(generationRun.meetingId, id), eq(generationRun.kind, "extract")))
      .orderBy(desc(generationRun.createdAt))
      .limit(1),
  ]);
  const ids = [...new Set(insights.flatMap((i) => i.segmentIds))];
  const lines = ids.length
    ? await db()
        .select({ id: segment.id, speaker: segment.speaker, text: segment.text, textEn: segment.textEn, startSec: segment.startSec })
        .from(segment)
        .where(and(eq(segment.meetingId, id), inArray(segment.id, ids)))
    : [];
  const result = (runs[0]?.result ?? null) as { summary?: unknown } | null;
  return NextResponse.json({ insights, run: runs[0] ?? null, segments: lines, summary: result?.summary ?? null });
});
