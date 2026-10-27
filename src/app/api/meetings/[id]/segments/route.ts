import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMeetingAccess } from "@/server/auth";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";
import { broadcastSegment } from "@/server/livekit";
import { savedSegments } from "@/server/segment-dedupe";
import { addSegment } from "@/server/segments";

export const dynamic = "force-dynamic";

const input = z.object({
  speaker: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2000),
  startSec: z.number().min(0).max(24 * 3600).default(0),
  capturedAt: z.number().int().positive().optional(),
  clientId: z.string().regex(/^[\w-]{8,64}$/),
});

type Saved = Awaited<ReturnType<typeof addSegment>>;

/**
 * A final phrase recognized in a participant's browser. Order: access check, persist, then broadcast
 * over LiveKit. Only this route creates transcript rows; interim text never reaches the database.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "segments", 240);
  const { id } = await ctx.params;
  const { meeting: m } = await requireMeetingAccess(req, id);
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting already ended");
  const v = await parseBody(req, input);

  // A retried POST with the same clientId gets the first result: no second row, no second broadcast.
  const key = `${id}:${v.clientId}`;
  let work = savedSegments.get(key) as Promise<Saved> | undefined;
  const duplicate = !!work;
  if (!work) {
    work = addSegment(id, { speaker: v.speaker, text: v.text, startSec: v.startSec });
    savedSegments.set(key, work);
    work.catch(() => savedSegments.delete(key));
    work.then((row) => {
      void broadcastSegment({
        id: row.id,
        meetingId: id,
        idx: row.idx,
        speaker: row.speaker,
        text: row.text,
        startSec: row.startSec,
        capturedAt: v.capturedAt ?? null,
      });
    });
  }
  const segment = await work;
  return NextResponse.json({ segment, duplicate }, { status: duplicate ? 200 : 201 });
});
