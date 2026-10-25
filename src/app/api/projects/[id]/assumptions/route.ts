import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";
import { getProject } from "@/server/queries";
import { assumptionInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await getProject(id);
  const rows = await db()
    .select()
    .from(schema.assumption)
    .where(eq(schema.assumption.projectId, id))
    .orderBy(asc(schema.assumption.createdAt));
  return NextResponse.json(rows);
});

const bulk = z.union([assumptionInput, z.array(assumptionInput).min(1).max(30)]);

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await getProject(id);
  const v = await parseBody(req, bulk);
  const items = Array.isArray(v) ? v : [v];
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.assumption)
    .where(eq(schema.assumption.projectId, id));
  if (Number(n) + items.length > 30) throw new ApiError(400, "limit", "A project holds at most 30 assumptions");
  const rows = await db()
    .insert(schema.assumption)
    .values(items.map((i) => ({ ...i, projectId: id })))
    .returning();
  return NextResponse.json(Array.isArray(v) ? rows : rows[0], { status: 201 });
});
