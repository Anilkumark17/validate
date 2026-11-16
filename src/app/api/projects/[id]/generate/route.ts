import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { launch, startRun } from "@/server/board/generate";
import { db, schema } from "@/server/db";
import { saveFocusNote } from "@/server/project-context";
import { handle, parseBody, rateLimit } from "@/server/http";
import { SETUP_ASPECT_LABEL, generateInput } from "@/lib/board/schemas";

const { generationRun } = schema;

/** A retry sends no aspects. Keep the ones the founder already chose on the earlier run. */
async function focusForRun(projectId: string, aspects: string[], note: string) {
  if (aspects.length > 0 || note.trim()) return { aspects, note };
  const [prev] = await db()
    .select({ input: generationRun.input })
    .from(generationRun)
    .where(and(eq(generationRun.projectId, projectId), eq(generationRun.kind, "initial")))
    .orderBy(desc(generationRun.createdAt))
    .limit(1);
  const saved = (prev?.input ?? {}) as { aspects?: string[]; note?: string };
  return { aspects: saved.aspects ?? [], note: saved.note ?? "" };
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Starts (or retries) the first generation. Returns 202 at once; the work continues on the server
 * and the client polls /generation. Safe to call twice: the same key, a running run, or a finished
 * run returns the existing run, and rows are de-duplicated by title and role.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "generate", 10);
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, generateInput);
  const labeled = [...new Set(v.aspects.map((a) => (a in SETUP_ASPECT_LABEL ? SETUP_ASPECT_LABEL[a as keyof typeof SETUP_ASPECT_LABEL] : a)))];
  const focus = await focusForRun(id, labeled, v.note);
  await saveFocusNote(id, focus.aspects, focus.note);
  const { run, started } = await startRun(id, "initial", focus, v.idempotencyKey);
  if (started) launch(run.id);
  return NextResponse.json({ run, started }, { status: 202 });
});
