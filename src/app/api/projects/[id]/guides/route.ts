import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { guideRequest } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { createGuide } from "@/server/board/guides";
import { db, schema } from "@/server/db";
import { handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const rows = await db().select().from(schema.interviewGuide).where(eq(schema.interviewGuide.projectId, id)).orderBy(desc(schema.interviewGuide.createdAt));
  return NextResponse.json(rows);
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "guide", 10);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, guideRequest);
  return NextResponse.json(await createGuide(id, v.stakeholderId), { status: 201 });
});
