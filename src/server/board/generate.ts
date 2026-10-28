import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { NEAR_DUPLICATE, normalizeKey, similarity, type Status } from "@/lib/board/constants";
import { generationOutputSchema, type GenerationOutput } from "@/lib/board/schemas";
import { db, schema } from "../db";
import { selectExamples } from "./examples";
import { glmJson } from "./glm";
import { buildGenerationPrompt, type PromptProject } from "./prompts";

const { generationRun, stakeholder, assumption, assumptionStakeholder, project, projectContext } = schema;
type Run = typeof generationRun.$inferSelect;

/** A run that never finished (server restarted mid run) is closed after this long so retry works. */
const STALE_MS = 6 * 60_000;

const g = globalThis as unknown as { __activeRuns?: Set<string> };
const active = (g.__activeRuns ??= new Set());

export interface RunResult {
  created: { assumptions: number; stakeholders: number; links: number };
  skipped: { assumptions: number; stakeholders: number };
  suggestedChanges: { assumptionId: string; title: string; field: string; proposed: string; reason: string }[];
  possiblyObsolete: { assumptionId: string; title: string; reason: string }[];
}

export async function loadPromptProject(projectId: string): Promise<PromptProject> {
  const [p] = await db().select().from(project).where(eq(project.id, projectId));
  if (!p) throw new Error("Project not found");
  const notes = await db().select({ title: projectContext.title, content: projectContext.content }).from(projectContext).where(eq(projectContext.projectId, projectId)).orderBy(asc(projectContext.createdAt));
  return {
    name: p.name,
    idea: p.description ?? "",
    audience: p.targetUser,
    audienceState: (p.audienceState as PromptProject["audienceState"]) ?? "unknown",
    context: notes.map((n) => `${n.title}: ${n.content}`).join("\n\n"),
  };
}

export async function latestRun(projectId: string, kind?: "initial" | "refine"): Promise<Run | null> {
  const where = kind ? and(eq(generationRun.projectId, projectId), eq(generationRun.kind, kind)) : eq(generationRun.projectId, projectId);
  const [r] = await db().select().from(generationRun).where(where).orderBy(desc(generationRun.createdAt)).limit(1);
  return r ?? null;
}

/**
 * Creates a run, or returns the one that already covers this request:
 * the same idempotency key, a run that is still going, or (initial only) a completed initial run.
 */
export async function startRun(
  projectId: string,
  kind: "initial" | "refine",
  input: unknown,
  idempotencyKey: string,
): Promise<{ run: Run; started: boolean }> {
  await db()
    .update(generationRun)
    .set({ status: "failed", error: "The run did not finish (server restarted or timed out). Retry generation.", finishedAt: new Date() })
    .where(and(eq(generationRun.projectId, projectId), inArray(generationRun.status, ["pending", "running"]), lt(generationRun.createdAt, new Date(Date.now() - STALE_MS))));

  const [busy] = await db()
    .select()
    .from(generationRun)
    .where(and(eq(generationRun.projectId, projectId), inArray(generationRun.status, ["pending", "running"])))
    .limit(1);
  if (busy) return { run: busy, started: false };

  if (kind === "initial") {
    const [done] = await db()
      .select()
      .from(generationRun)
      .where(and(eq(generationRun.projectId, projectId), eq(generationRun.kind, "initial"), eq(generationRun.status, "completed")))
      .limit(1);
    if (done) return { run: done, started: false };
  }

  const inserted = await db()
    .insert(generationRun)
    .values({ projectId, kind, idempotencyKey, input: input as object, status: "pending" })
    .onConflictDoNothing({ target: [generationRun.projectId, generationRun.idempotencyKey] })
    .returning();
  if (inserted[0]) return { run: inserted[0], started: true };
  const [same] = await db().select().from(generationRun).where(and(eq(generationRun.projectId, projectId), eq(generationRun.idempotencyKey, idempotencyKey)));
  return { run: same!, started: false };
}

/** Fire and forget. Errors are stored on the run, never thrown to the caller. */
export function launch(runId: string) {
  if (active.has(runId)) return;
  active.add(runId);
  void executeRun(runId)
    .catch((e) => console.error("[generation] unexpected", e instanceof Error ? e.message : e))
    .finally(() => active.delete(runId));
}

async function fail(runId: string, error: string, attempts = 0) {
  await db()
    .update(generationRun)
    .set({ status: "failed", error: error.slice(0, 500), attempts, finishedAt: new Date() })
    .where(eq(generationRun.id, runId));
}

export async function executeRun(runId: string): Promise<void> {
  const [run] = await db().select().from(generationRun).where(eq(generationRun.id, runId));
  if (!run || run.status === "completed") return;
  await db().update(generationRun).set({ status: "running", startedAt: new Date(), error: null }).where(eq(generationRun.id, runId));
  let attempts = 0;
  try {
    const p = await loadPromptProject(run.projectId);
    if (p.idea.trim().length < 10) throw new Error("The project has no description to work from");
    const [existingAssumptions, existingStakeholders] = await Promise.all([
      db().select({ id: assumption.id, title: assumption.title, status: assumption.status }).from(assumption).where(eq(assumption.projectId, run.projectId)).orderBy(asc(assumption.createdAt)),
      db().select({ id: stakeholder.id, roleName: stakeholder.roleName }).from(stakeholder).where(eq(stakeholder.projectId, run.projectId)).orderBy(asc(stakeholder.createdAt)),
    ]);
    const stakeholderKeys = existingStakeholders.map((s, i) => ({ key: `e${i + 1}`, ...s }));
    const input = (run.input ?? {}) as { dimensions?: string[]; notes?: Record<string, string> };
    const examples = selectExamples(`${p.name} ${p.idea} ${p.context} ${p.audience ?? ""}`);
    const prompt = buildGenerationPrompt({
      mode: run.kind,
      project: p,
      examples,
      existingAssumptions: existingAssumptions.map((a, i) => ({ key: `x${i + 1}`, title: a.title, status: a.status })),
      existingStakeholders: stakeholderKeys.map((s) => ({ key: s.key, roleName: s.roleName })),
      refine: run.kind === "refine" ? { dimensions: input.dimensions ?? [], notes: input.notes ?? {} } : undefined,
    });
    const out = await glmJson(
      generationOutputSchema({ existingStakeholderKeys: stakeholderKeys.map((s) => s.key), mode: run.kind }),
      { system: prompt.system, user: prompt.user, maxTokens: 8000 },
    );
    attempts = out.attempts;
    const result = await persist({
      run,
      out: out.data,
      audienceUnconfirmed: !(p.audienceState === "confirmed" || p.audienceState === "detected"),
      existingAssumptions,
      stakeholderKeyToId: new Map(stakeholderKeys.map((s) => [s.key, s.id])),
      model: out.model,
      examples: examples.map((e) => e.id),
      attempts,
    });
    void result;
  } catch (e) {
    await fail(runId, e instanceof Error ? e.message : String(e), attempts);
  }
}

async function persist(a: {
  run: Run;
  out: GenerationOutput;
  audienceUnconfirmed: boolean;
  existingAssumptions: { id: string; title: string; status: Status }[];
  stakeholderKeyToId: Map<string, string>;
  model: string;
  examples: string[];
  attempts: number;
}) {
  const { run, out } = a;
  const projectId = run.projectId;
  return db().transaction(async (tx) => {
    const sMap = new Map<string, string>(a.stakeholderKeyToId);
    const res: RunResult = { created: { assumptions: 0, stakeholders: 0, links: 0 }, skipped: { assumptions: 0, stakeholders: 0 }, suggestedChanges: [], possiblyObsolete: [] };

    for (const s of out.stakeholders) {
      const dedupeKey = normalizeKey(s.roleName);
      const ins = await tx
        .insert(stakeholder)
        .values({
          projectId,
          roleName: s.roleName,
          description: s.description,
          whyItMatters: s.whyItMatters,
          relevance: s.relevance,
          interviewPriority: s.interviewPriority,
          recruitmentCriteria: s.recruitmentCriteria,
          interviewQuestions: s.interviewQuestions,
          expectedEvidence: s.expectedEvidence,
          source: "ai_generated",
          dedupeKey,
          generationRunId: run.id,
        })
        .onConflictDoNothing({ target: [stakeholder.projectId, stakeholder.dedupeKey] })
        .returning({ id: stakeholder.id });
      if (ins[0]) {
        sMap.set(s.id, ins[0].id);
        res.created.stakeholders++;
      } else {
        // The role exists already. Keep the user's version untouched and link to it.
        const [ex] = await tx.select({ id: stakeholder.id }).from(stakeholder).where(and(eq(stakeholder.projectId, projectId), eq(stakeholder.dedupeKey, dedupeKey)));
        if (ex) sMap.set(s.id, ex.id);
        res.skipped.stakeholders++;
      }
    }

    const titles = a.existingAssumptions.map((x) => x.title);
    const aMap = new Map<string, string>();
    for (const x of out.assumptions) {
      if (titles.some((t) => similarity(t, x.title) >= NEAR_DUPLICATE)) {
        res.skipped.assumptions++;
        continue;
      }
      const ins = await tx
        .insert(assumption)
        .values({
          projectId,
          title: x.title,
          description: x.description,
          category: x.category,
          rationale: x.rationale,
          impact: x.impact,
          uncertainty: x.uncertainty,
          validationMethod: x.validationMethod,
          validationQuestions: x.validationQuestions,
          experimentDescription: x.experimentDescription,
          successCriteria: x.successCriteria,
          status: "generated",
          source: "ai_generated",
          provisional: a.audienceUnconfirmed ? x.provisional : false,
          dedupeKey: normalizeKey(x.title),
          generationRunId: run.id,
        })
        .onConflictDoNothing({ target: [assumption.projectId, assumption.dedupeKey] })
        .returning({ id: assumption.id });
      if (ins[0]) {
        aMap.set(x.id, ins[0].id);
        titles.push(x.title);
        res.created.assumptions++;
      } else {
        res.skipped.assumptions++;
      }
    }

    for (const l of out.assumptionStakeholderLinks) {
      const aid = aMap.get(l.assumptionId);
      const sid = sMap.get(l.stakeholderId);
      if (!aid || !sid) continue;
      const ins = await tx
        .insert(assumptionStakeholder)
        .values({ projectId, assumptionId: aid, stakeholderId: sid })
        .onConflictDoNothing()
        .returning({ a: assumptionStakeholder.assumptionId });
      if (ins[0]) res.created.links++;
    }

    // Refinement suggestions never touch data: they are stored on the run for the user to confirm.
    const byTitle = (t: string) => {
      let best: { id: string; title: string; status: Status; s: number } | null = null;
      for (const x of a.existingAssumptions) {
        const s = similarity(x.title, t);
        if (!best || s > best.s) best = { ...x, s };
      }
      return best && best.s >= 0.6 ? best : null;
    };
    for (const c of out.suggestedChanges) {
      const m = byTitle(c.assumptionTitle);
      if (m && m.status !== "validated" && m.status !== "invalidated") {
        res.suggestedChanges.push({ assumptionId: m.id, title: m.title, field: c.field, proposed: c.proposed, reason: c.reason });
      }
    }
    for (const o of out.possiblyObsolete) {
      const m = byTitle(o.assumptionTitle);
      if (m) res.possiblyObsolete.push({ assumptionId: m.id, title: m.title, reason: o.reason });
    }

    await tx
      .update(generationRun)
      .set({
        status: "completed",
        summary: out.generationSummary,
        result: res,
        model: a.model,
        examples: a.examples,
        attempts: a.attempts,
        error: null,
        finishedAt: new Date(),
      })
      .where(eq(generationRun.id, run.id));
    return res;
  });
}

