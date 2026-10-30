import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, isUuid, notFound, parseBody } from "@/server/http";
import { personaPatch } from "@/lib/schemas";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; pid: string }> };

const where = (projectId: string, pid: string) => and(eq(schema.persona.id, pid), eq(schema.persona.projectId, projectId));

/** Approve a draft, or move an approved persona back to draft. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id, pid } = await ctx.params;
  await requireProject(req, id);
  if (!isUuid(pid)) throw notFound("Persona");
  const v = await parseBody(req, personaPatch);
  const [row] = await db().update(schema.persona).set({ status: v.status, updatedAt: new Date() }).where(where(id, pid)).returning();
  if (!row) throw notFound("Persona");
  return NextResponse.json(row);
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { id, pid } = await ctx.params;
  await requireProject(req, id);
  if (!isUuid(pid)) throw notFound("Persona");
  const rows = await db().delete(schema.persona).where(where(id, pid)).returning({ id: schema.persona.id });
  if (rows.length === 0) throw notFound("Persona");
  return NextResponse.json({ ok: true });
});
