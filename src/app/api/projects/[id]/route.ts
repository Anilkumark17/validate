import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { readMainContext, saveMainContext } from "@/server/project-context";
import { projectForm } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { project } = await requireProject(req, id);
  return NextResponse.json({ ...project, context: await readMainContext(id) });
});

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const { context, ...v } = await parseBody(req, projectForm);
  const p = await db().transaction(async (tx) => {
    const [row] = await tx
      .update(schema.project)
      .set({
        name: v.name,
        // omitted fields stay as they are; an empty string clears the value
        ...(v.description !== undefined && { description: v.description || null }),
        ...(v.targetUser !== undefined && { targetUser: v.targetUser || null }),
      })
      .where(eq(schema.project.id, id))
      .returning();
    // context omitted = leave it alone; empty string = remove the main entry
    if (context !== undefined) await saveMainContext(tx, id, context);
    return row!;
  });
  return NextResponse.json({ ...p, context: context ?? (await readMainContext(id)) });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  await db().delete(schema.project).where(eq(schema.project.id, id));
  return NextResponse.json({ ok: true });
});
