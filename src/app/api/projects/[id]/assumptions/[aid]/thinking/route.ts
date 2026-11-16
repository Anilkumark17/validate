import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProject } from "@/server/auth";
import { requireAssumption } from "@/server/board/queries";
import { runUpdateTurn } from "@/server/board/update-thinking";
import { GlmError } from "@/server/board/glm";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const input = z.object({
  newInput: z.string().trim().min(1).max(4000),
  conversation: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .max(12)
    .default([]),
});

/** One turn of folding a new thought into a single assumption. Nothing is saved. The person decides later. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) => {
  rateLimit(req, "update_thinking", 20);
  const { id, aid } = await ctx.params;
  await requireProject(req, id);
  await requireAssumption(id, aid);
  const v = await parseBody(req, input);
  try {
    const turn = await runUpdateTurn(id, aid, v.newInput, v.conversation);
    return NextResponse.json(turn);
  } catch (e) {
    if (e instanceof GlmError) throw new ApiError(502, "update_failed", e.message);
    throw e;
  }
});
