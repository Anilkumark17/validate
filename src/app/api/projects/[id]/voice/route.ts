import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { ApiError, handle } from "@/server/http";
import { buildVoice } from "@/server/llm/tasks";
import { getProject } from "@/server/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await getProject(id);
  return NextResponse.json({ voice: p.voice ?? null, updatedAt: p.voiceUpdatedAt });
});

export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const p = await getProject(id);
  const facts = await db()
    .select()
    .from(schema.fact)
    .where(eq(schema.fact.projectId, id))
    .orderBy(desc(schema.fact.createdAt))
    .limit(120);
  if (facts.length < 3) throw new ApiError(400, "not_enough_facts", "Analyze at least one interview first. Facts appear after each batch.");
  const voice = await buildVoice({
    project: { name: p.name, targetUser: p.targetUser },
    facts: facts.map((f) => ({ id: f.id, kind: f.kind, statement: f.statement, quote: f.quote, phrases: f.phrases, speaker: f.speaker })),
  });
  const [row] = await db()
    .update(schema.project)
    .set({ voice, voiceUpdatedAt: new Date() })
    .where(eq(schema.project.id, id))
    .returning();
  return NextResponse.json({ voice: row!.voice, updatedAt: row!.voiceUpdatedAt });
});
