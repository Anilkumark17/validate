import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProject } from "@/server/auth";
import { GlmError } from "@/server/board/glm";
import { runRefineCheck } from "@/server/board/refine-check";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";
import { REFINE_DIMENSIONS } from "@/lib/board/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const input = z.object({
  learning: z.string().trim().max(4000).default(""),
  dimensions: z.array(z.enum(REFINE_DIMENSIONS)).max(REFINE_DIMENSIONS.length).default([]),
  conversation: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .max(4)
    .default([]),
});

/** One gap question before a refine run. Nothing is saved. At most two questions. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "refine_check", 20);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, input);
  try {
    const turn = await runRefineCheck(id, v.learning, v.dimensions, v.conversation);
    return NextResponse.json(turn);
  } catch (e) {
    if (e instanceof GlmError) throw new ApiError(502, "refine_check_failed", e.message);
    throw e;
  }
});
