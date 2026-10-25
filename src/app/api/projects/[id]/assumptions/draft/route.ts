import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/server/http";
import { getProject } from "@/server/queries";
import { draftAssumptions } from "@/server/llm/tasks";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getProject(id);
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(20).max(20000) }));
  const drafts = await draftAssumptions({ productContext: text });
  return NextResponse.json(drafts);
});
