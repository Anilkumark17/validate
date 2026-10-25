import { NextResponse } from "next/server";
import { handle } from "@/server/http";
import { enqueueMeeting } from "@/server/pipeline";
import { getMeeting } from "@/server/queries";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getMeeting(id);
  enqueueMeeting(id);
  return NextResponse.json({ ok: true });
});
