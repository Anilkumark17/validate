import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { stopRun } from "@/server/board/generate";
import { handle, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";

/** Stops the active generation. Rows already saved stay. Nothing further is written. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "generation_stop", 20);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const run = await stopRun(id);
  return NextResponse.json({ run, stopped: !!run });
});
