import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { launch, startRun } from "@/server/board/generate";
import { handle, parseBody, rateLimit } from "@/server/http";
import { generateInput } from "@/lib/board/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Starts (or retries) the first generation. Returns 202 at once; the work continues on the server
 * and the client polls /generation. Safe to call twice: the same key, a running run, or a finished
 * run returns the existing run, and rows are de-duplicated by title and role.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "generate", 10);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, generateInput);
  const { run, started } = await startRun(id, "initial", {}, v.idempotencyKey);
  if (started) launch(run.id);
  return NextResponse.json({ run, started }, { status: 202 });
});
