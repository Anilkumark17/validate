import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { ApiError, handle } from "@/server/http";
import { buildPersona } from "@/server/llm/tasks";
import { getProject } from "@/server/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await getProject(id);
  return NextResponse.json({ persona: p.persona ?? null, updatedAt: p.personaUpdatedAt });
});

export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await getProject(id);
  const { evidence, link, assumption } = schema;
  const rows = await db()
    .select({
      speaker: evidence.speaker,
      claim: evidence.claim,
      quote: evidence.quote,
      stance: link.stance,
      assumption: assumption.statement,
    })
    .from(link)
    .innerJoin(evidence, eq(evidence.id, link.evidenceId))
    .innerJoin(assumption, eq(assumption.id, link.assumptionId))
    .where(and(eq(assumption.projectId, id), eq(link.rejected, false)))
    .limit(150);
  const speakers = new Set(rows.map((r) => r.speaker).filter(Boolean));
  if (rows.length < 3) throw new ApiError(400, "not_enough_evidence", "Run at least one analyzed interview before building a persona.");
  const persona = await buildPersona({ project: { name: p.name, targetUser: p.targetUser }, items: rows });
  const [updated] = await db()
    .update(schema.project)
    .set({ persona: { ...persona, speakerCount: speakers.size }, personaUpdatedAt: new Date() })
    .where(eq(schema.project.id, id))
    .returning();
  return NextResponse.json({ persona: updated!.persona, updatedAt: updated!.personaUpdatedAt });
});
