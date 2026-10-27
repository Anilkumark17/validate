import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return NextResponse.json((await requireProject(req, id)).project);
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  await db().delete(schema.project).where(eq(schema.project.id, id));
  return NextResponse.json({ ok: true });
});
