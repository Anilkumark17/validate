import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle, isUuid, notFound, parseBody } from "@/server/http";
import { assumptionPatch } from "@/lib/schemas";
import { publish } from "@/server/sse";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!isUuid(id)) throw notFound("Assumption");
  const [a] = await db().select().from(schema.assumption).where(eq(schema.assumption.id, id));
  if (!a) throw notFound("Assumption");
  return a;
}

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const a = await load(id);
  const v = await parseBody(req, assumptionPatch);
  const [row] = await db()
    .update(schema.assumption)
    .set({ ...v, updatedAt: new Date() })
    .where(eq(schema.assumption.id, id))
    .returning();
  publish(a.projectId, "assumption.updated", { assumption: row });
  return NextResponse.json(row);
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const a = await load(id);
  await db().delete(schema.assumption).where(eq(schema.assumption.id, id));
  publish(a.projectId, "assumption.updated", { deleted: id });
  return NextResponse.json({ ok: true });
});
