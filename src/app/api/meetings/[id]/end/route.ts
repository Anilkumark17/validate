import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { flushMeeting } from "@/server/pipeline";
import { getMeeting } from "@/server/queries";
import { publish } from "@/server/sse";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const m = await getMeeting(id);
  if (m.state !== "ended") {
    await db()
      .update(schema.meeting)
      .set({ state: "ended", endedAt: new Date(), heldAt: new Date().toISOString().slice(0, 10) })
      .where(eq(schema.meeting.id, id));
  }
  await flushMeeting(id);
  publish(m.projectId, "meeting.ended", { meetingId: id });
  return NextResponse.json({ ok: true });
});
