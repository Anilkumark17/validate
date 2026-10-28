import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { getBoard } from "@/server/board/queries";
import { latestRun } from "@/server/board/generate";
import { handle } from "@/server/http";
import { readMainContext } from "@/server/project-context";

export const dynamic = "force-dynamic";

/** Everything the workspace needs in one round: assumptions, stakeholders, derived progress, latest runs. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { project } = await requireProject(req, id);
  const [board, initial, refine, context] = await Promise.all([getBoard(id), latestRun(id, "initial"), latestRun(id, "refine"), readMainContext(id)]);
  return NextResponse.json({ project: { ...project, context }, ...board, runs: { initial, refine } });
});
