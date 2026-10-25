import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { ApiError, handle } from "@/server/http";
import { getMeeting } from "@/server/queries";
import { publish } from "@/server/sse";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const m = await getMeeting(id);
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting already ended");
  if (m.state === "live") return NextResponse.json({ startedAt: m.startedAt, state: m.state });
  const [row] = await db()
    .update(schema.meeting)
    .set({ state: "live", startedAt: new Date() })
    .where(eq(schema.meeting.id, id))
    .returning();
  publish(m.projectId, "meeting.updated", { meetingId: id, state: "live" });
  return NextResponse.json({ startedAt: row!.startedAt, state: row!.state });
});
