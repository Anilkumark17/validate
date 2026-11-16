import { NextResponse } from "next/server";
import { requireMeetingHost } from "@/server/auth";
import { ApiError, handle, rateLimit } from "@/server/http";
import { launchExtract, startExtract } from "@/server/insights/extract";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Starts an extract. The row is stored as ai_suggested; a person confirms it later. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  rateLimit(req, "meeting_extract", 8);
  const row = await requireMeetingHost(req, id);
  if (row.state !== "ended") throw new ApiError(409, "meeting_open", "The meeting has to end before insights can be extracted");
  if (!row.consentAt) throw new ApiError(409, "consent_required", "Record the customer's consent before extracting");
  const { run, started } = await startExtract(row);
  if (started) launchExtract(run.id);
  return NextResponse.json({ run, started }, { status: 202 });
});
