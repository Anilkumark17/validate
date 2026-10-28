import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { latestRun } from "@/server/board/generate";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

/** Polled while a run is active. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const [initial, refine] = await Promise.all([latestRun(id, "initial"), latestRun(id, "refine")]);
  return NextResponse.json({ initial, refine });
});
