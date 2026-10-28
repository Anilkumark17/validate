import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { launch, startRun } from "@/server/board/generate";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";
import { refineInput } from "@/lib/board/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Refine: adds NEW assumptions and roles from extra context. Existing items, evidence and decisions are never changed. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "refine", 10);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, refineInput);
  if (v.dimensions.every((d) => !(v.notes[d] ?? "").trim())) {
    throw new ApiError(400, "no_context", "Add some detail for at least one selected dimension");
  }
  const { run, started } = await startRun(id, "refine", { dimensions: v.dimensions, notes: v.notes }, v.idempotencyKey);
  if (started) launch(run.id);
  return NextResponse.json({ run, started }, { status: 202 });
});
