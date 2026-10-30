import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";
import { MAX_PERSONAS, personaInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const rows = await db().select().from(schema.persona).where(eq(schema.persona.projectId, id)).orderBy(desc(schema.persona.createdAt));
  return NextResponse.json(rows);
});

/** New personas are always drafts. Approval is a separate, deliberate step. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, personaInput);
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(schema.persona).where(eq(schema.persona.projectId, id));
  if (n >= MAX_PERSONAS) throw new ApiError(409, "persona_limit", `A project can hold at most ${MAX_PERSONAS} personas`);
  const [row] = await db().insert(schema.persona).values({ projectId: id, ...v }).returning();
  return NextResponse.json(row, { status: 201 });
});
