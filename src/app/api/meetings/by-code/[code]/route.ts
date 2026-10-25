import { NextResponse } from "next/server";
import { handle } from "@/server/http";
import { getMeetingByCode, getProject } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const m = await getMeetingByCode(code);
  const p = await getProject(m.projectId);
  return NextResponse.json({ id: m.id, title: m.title, state: m.state, scheduledFor: m.scheduledFor, projectName: p.name });
});
