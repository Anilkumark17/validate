import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle, isUuid, notFound, parseBody } from "@/server/http";
import { recomputeAssumptions } from "@/server/pipeline";
import { linkPatch } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) throw notFound("Link");
  const v = await parseBody(req, linkPatch);
  const [row] = await db()
    .update(schema.link)
    .set({ ...v, origin: "user" })
    .where(eq(schema.link.id, id))
    .returning();
  if (!row) throw notFound("Link");
  const [a] = await db().select().from(schema.assumption).where(eq(schema.assumption.id, row.assumptionId));
  const [ev] = await db().select({ meetingId: schema.evidence.meetingId }).from(schema.evidence).where(eq(schema.evidence.id, row.evidenceId));
  if (a) await recomputeAssumptions(a.projectId, [a.id], ev?.meetingId ?? null);
  return NextResponse.json(row);
});
