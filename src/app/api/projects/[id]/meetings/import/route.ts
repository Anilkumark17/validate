import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";
import { createMeeting, getProject } from "@/server/queries";
import { enqueueMeeting, insertSegments } from "@/server/pipeline";
import { parseTranscript } from "@/server/transcript";
import { importInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getProject(id);
  const v = await parseBody(req, importInput);
  const segs = parseTranscript(v.content);
  if (segs.length === 0) throw new ApiError(400, "empty_transcript", "No transcript lines found");
  const speakers = [...new Set(segs.map((s) => s.speaker).filter((s): s is string => !!s))];
  const m = await createMeeting(id, {
    title: v.title,
    source: "transcript_upload",
    state: "ended",
    heldAt: new Date().toISOString().slice(0, 10),
    participants: speakers,
    endedAt: new Date(),
  });
  await insertSegments(m.id, segs);
  await db().update(schema.meeting).set({ jobStatus: "queued" }).where(eq(schema.meeting.id, m.id));
  enqueueMeeting(m.id);
  return NextResponse.json({ ...m, segmentCount: segs.length }, { status: 201 });
});
