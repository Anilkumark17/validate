import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { listEvidence } from "@/server/board/queries";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  return NextResponse.json(await listEvidence(id));
});
