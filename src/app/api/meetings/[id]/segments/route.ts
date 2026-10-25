import { NextResponse } from "next/server";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";
import { addSegment } from "@/server/pipeline";
import { getMeeting } from "@/server/queries";
import { segmentInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "segments", 240);
  const { id } = await ctx.params;
  const m = await getMeeting(id);
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting already ended");
  const v = await parseBody(req, segmentInput);
  const row = await addSegment(id, v);
  return NextResponse.json(row, { status: 201 });
});
