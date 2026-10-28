import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, isUuid, notFound, parseBody } from "@/server/http";
import { contextInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; contextId: string }> };

const where = (projectId: string, contextId: string) =>
  and(eq(schema.projectContext.id, contextId), eq(schema.projectContext.projectId, projectId));

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id, contextId } = await ctx.params;
  await requireProject(req, id);
  if (!isUuid(contextId)) throw notFound("Context entry");
  const v = await parseBody(req, contextInput);
  const [row] = await db()
    .update(schema.projectContext)
    .set({ title: v.title, content: v.content, updatedAt: new Date() })
    .where(where(id, contextId))
    .returning();
  if (!row) throw notFound("Context entry");
  return NextResponse.json(row);
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { id, contextId } = await ctx.params;
  await requireProject(req, id);
  if (!isUuid(contextId)) throw notFound("Context entry");
  const rows = await db().delete(schema.projectContext).where(where(id, contextId)).returning({ id: schema.projectContext.id });
  if (rows.length === 0) throw notFound("Context entry");
  return NextResponse.json({ ok: true });
});
