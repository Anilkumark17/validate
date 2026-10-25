import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { getProject } from "@/server/queries";
import { suggestQuestions } from "@/server/llm/tasks";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await getProject(id);
  const all = await db().select().from(schema.assumption).where(eq(schema.assumption.projectId, id));
  const weak = all.filter((a) => a.status === "untested" || a.status === "mixed" || (a.status === "supporting" && a.confidence < 0.5));
  const items = await suggestQuestions({
    assumptions: weak.slice(0, 12).map((a) => ({ id: a.id, statement: a.statement, type: a.type, status: a.status })),
  });
  return NextResponse.json(items);
});
