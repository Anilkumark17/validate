import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";
import { contextInput, MAX_CONTEXT_ENTRIES } from "@/lib/schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Context entries are text only and visible to the project owner only. */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const rows = await db()
    .select()
    .from(schema.projectContext)
    .where(eq(schema.projectContext.projectId, id))
    .orderBy(asc(schema.projectContext.createdAt));
  return NextResponse.json(rows);
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, contextInput);
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.projectContext)
    .where(eq(schema.projectContext.projectId, id));
  if (n >= MAX_CONTEXT_ENTRIES) {
    throw new ApiError(409, "context_limit", `A project can hold at most ${MAX_CONTEXT_ENTRIES} context entries`);
  }
  const [row] = await db().insert(schema.projectContext).values({ projectId: id, title: v.title, content: v.content }).returning();
  return NextResponse.json(row, { status: 201 });
});
