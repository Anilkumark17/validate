import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { getProject } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return NextResponse.json(await getProject(id));
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getProject(id);
  await db().delete(schema.project).where(eq(schema.project.id, id));
  return NextResponse.json({ ok: true });
});
