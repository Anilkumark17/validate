import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireMeetingHost } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { enforceMeetingTime } from "@/server/limits";
import { publish } from "@/server/sse";

export const dynamic = "force-dynamic";

/** Only the host starts the clock. A second call does not move startedAt. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const m = await requireMeetingHost(req, id);
  await enforceMeetingTime(m);
  const [row] = await db()
    .update(schema.meeting)
    .set({ state: "live", startedAt: new Date() })
    .where(and(eq(schema.meeting.id, id), eq(schema.meeting.state, "scheduled")))
    .returning();
  if (row) {
    publish(m.projectId, "meeting.updated", { meetingId: id, state: "live" });
    return NextResponse.json({ startedAt: row.startedAt, state: row.state });
  }
  const [cur] = await db().select().from(schema.meeting).where(eq(schema.meeting.id, id));
  return NextResponse.json({ startedAt: cur!.startedAt, state: cur!.state });
});
