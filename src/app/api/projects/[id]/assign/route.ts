import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { runAssign } from "@/server/board/assign";
import { GlmError } from "@/server/board/glm";
import { ApiError, handle, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Proposes assumption-to-stakeholder links. Nothing is saved. The person confirms later. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "assign", 8);
  const { id } = await ctx.params;
  await requireProject(req, id);
  try {
    return NextResponse.json(await runAssign(id));
  } catch (e) {
    if (e instanceof GlmError) throw new ApiError(502, "assign_failed", e.message);
    if (e instanceof Error && /no assumptions|stakeholder role/.test(e.message)) throw new ApiError(400, "assign_unavailable", e.message);
    throw e;
  }
});
