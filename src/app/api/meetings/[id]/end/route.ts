import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { requireMeetingHost } from "@/server/auth";
import { publish } from "@/server/sse";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const m = await requireMeetingHost(req, id);
  if (m.state !== "ended") {
    await db()
      .update(schema.meeting)
      .set({ state: "ended", endedAt: new Date(), heldAt: new Date().toISOString().slice(0, 10) })
      .where(eq(schema.meeting.id, id));
  }
  publish(m.projectId, "meeting.ended", { meetingId: id });
  return NextResponse.json({ ok: true });
});
