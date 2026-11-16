import { NextResponse } from "next/server";
import { generateInput } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { launch, startRun } from "@/server/board/generate";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Starts generation again from the project idea and context, including personas and interview guides.
 * Nothing is deleted here. Untouched AI rows are replaced inside the save transaction, after the model
 * has returned, so a failed call leaves the previous board, guides, and drafts in place.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "regenerate", 5);
  const { id } = await ctx.params;
  const { project } = await requireProject(req, id);
  const v = await parseBody(req, generateInput);
  if ((project.description ?? "").trim().length < 10) {
    throw new ApiError(409, "no_idea", "Add a project description first. Regeneration works from the idea.");
  }
  const { run, started } = await startRun(id, "initial", { extras: true }, v.idempotencyKey, { force: true });
  if (started) launch(run.id);
  return NextResponse.json({ run, started }, { status: 202 });
});
