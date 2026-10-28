import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, isUuid, notFound } from "@/server/http";

export const dynamic = "force-dynamic";

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string; gid: string }> }) => {
  const { id, gid } = await ctx.params;
  await requireProject(req, id);
  if (!isUuid(gid)) throw notFound("Guide");
  const rows = await db()
    .delete(schema.interviewGuide)
    .where(and(eq(schema.interviewGuide.id, gid), eq(schema.interviewGuide.projectId, id)))
    .returning({ id: schema.interviewGuide.id });
  if (rows.length === 0) throw notFound("Guide");
  return NextResponse.json({ ok: true });
});
