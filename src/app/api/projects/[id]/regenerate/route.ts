import { and, eq, inArray, notExists } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateInput } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { findBusy, launch, startRun } from "@/server/board/generate";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const { assumption, assumptionEvidence, assumptionDecision, assumptionStakeholder, stakeholder, persona, interviewGuide, generationRun } = schema;

/**
 * Starts the whole thing again from the project idea and context: assumptions, stakeholder roles,
 * personas and interview guides. Only untouched AI output is replaced:
 *  - assumptions still in Generated with no evidence and no decisions
 *  - AI stakeholder roles with no evidence recorded against them
 *  - AI persona drafts (approved personas stay)
 *  - interview guides (they are rewritten from the new assumptions)
 * Anything the user wrote or worked on is kept, and the new run is told not to repeat it.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "regenerate", 5);
  const { id } = await ctx.params;
  const { project } = await requireProject(req, id);
  const v = await parseBody(req, generateInput);
  if ((project.description ?? "").trim().length < 10) {
    throw new ApiError(409, "no_idea", "Add a project description first. Regeneration works from the idea.");
  }
  const busy = await findBusy(id);
  if (busy) return NextResponse.json({ run: busy, started: false }, { status: 202 });

  await db().transaction(async (tx) => {
    await tx.delete(interviewGuide).where(eq(interviewGuide.projectId, id));
    await tx.delete(persona).where(and(eq(persona.projectId, id), eq(persona.source, "ai_generated"), eq(persona.status, "draft")));
    await tx.delete(assumption).where(
      and(
        eq(assumption.projectId, id),
        eq(assumption.source, "ai_generated"),
        eq(assumption.status, "generated"),
        notExists(tx.select({ x: assumptionEvidence.id }).from(assumptionEvidence).where(eq(assumptionEvidence.assumptionId, assumption.id))),
        notExists(tx.select({ x: assumptionDecision.id }).from(assumptionDecision).where(eq(assumptionDecision.assumptionId, assumption.id))),
      ),
    );
    await tx.delete(stakeholder).where(
      and(
        eq(stakeholder.projectId, id),
        eq(stakeholder.source, "ai_generated"),
        notExists(tx.select({ x: assumptionEvidence.id }).from(assumptionEvidence).where(eq(assumptionEvidence.stakeholderId, stakeholder.id))),
        // a role that is still linked to an assumption the user kept stays
        notExists(tx.select({ x: assumptionStakeholder.assumptionId }).from(assumptionStakeholder).where(eq(assumptionStakeholder.stakeholderId, stakeholder.id))),
      ),
    );
    // A finished first run would otherwise make the new one return it instead of starting.
    await tx.delete(generationRun).where(and(eq(generationRun.projectId, id), eq(generationRun.kind, "initial"), inArray(generationRun.status, ["completed", "failed"])));
  });

  const { run, started } = await startRun(id, "initial", { extras: true }, v.idempotencyKey);
  if (started) launch(run.id);
  return NextResponse.json({ run, started }, { status: 202 });
});
