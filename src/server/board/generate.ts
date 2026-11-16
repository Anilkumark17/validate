import { and, asc, desc, eq, inArray, lt, ne, notExists, sql } from "drizzle-orm";
import { NEAR_DUPLICATE, normalizeKey, similarity, type Status } from "@/lib/board/constants";
import { generationOutputSchema, type GenerationOutput } from "@/lib/board/schemas";
import { db, schema } from "../db";
import { selectExamples } from "./examples";
import { generateExtras } from "./extras";
import { glmJson } from "./glm";
import { buildGenerationPrompt, type PromptProject } from "./prompts";

const { generationRun, stakeholder, assumption, assumptionStakeholder, assumptionEvidence, assumptionDecision, project, projectContext } = schema;
type Run = typeof generationRun.$inferSelect;

/** A run that never finished (server restarted mid run) is closed after this long so retry works. */
const STALE_MS = 12 * 60_000;

const g = globalThis as unknown as { __activeRuns?: Set<string>; __runStops?: Map<string, AbortController> };
const active = (g.__activeRuns ??= new Set());
const stops = (g.__runStops ??= new Map());

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

/** Closes a run the process no longer has, then returns one that is still pending or running. */
export async function findBusy(projectId: string): Promise<Run | null> {
  await db()
    .update(generationRun)
    .set({ status: "failed", error: "The run did not finish (server restarted or timed out). Retry generation.", finishedAt: new Date() })
      .where(and(eq(generationRun.projectId, projectId), ne(generationRun.kind, "extract"), inArray(generationRun.status, ["pending", "running"]), lt(generationRun.createdAt, new Date(Date.now() - STALE_MS))));
  const [busy] = await db()
    .select()
    .from(generationRun)
    .where(and(eq(generationRun.projectId, projectId), ne(generationRun.kind, "extract"), inArray(generationRun.status, ["pending", "running"])))
    .limit(1);
  return busy ?? null;
}

/**
 * Assumptions and roles a regeneration must keep. Untouched AI rows are replaced inside the save
 * transaction, so the prompt must not be told to avoid repeating them.
 */
async function listKept(projectId: string): Promise<{ assumptions: { id: string; title: string; status: Status }[]; stakeholders: { id: string; roleName: string }[] }> {
  const [assumptions, evidenceA, decisions, stakeholders, evidenceS, links] = await Promise.all([
    db().select({ id: assumption.id, title: assumption.title, status: assumption.status, source: assumption.source }).from(assumption).where(eq(assumption.projectId, projectId)),
    db().select({ id: assumptionEvidence.assumptionId }).from(assumptionEvidence).where(eq(assumptionEvidence.projectId, projectId)),
    db().select({ id: assumptionDecision.assumptionId }).from(assumptionDecision).where(eq(assumptionDecision.projectId, projectId)),
    db().select({ id: stakeholder.id, roleName: stakeholder.roleName, source: stakeholder.source }).from(stakeholder).where(eq(stakeholder.projectId, projectId)),
    db().select({ id: assumptionEvidence.stakeholderId }).from(assumptionEvidence).where(eq(assumptionEvidence.projectId, projectId)),
    db().select({ stakeholderId: assumptionStakeholder.stakeholderId, assumptionId: assumptionStakeholder.assumptionId }).from(assumptionStakeholder).where(eq(assumptionStakeholder.projectId, projectId)),
  ]);
  const touchedA = new Set([...evidenceA.map((e) => e.id), ...decisions.map((d) => d.id)]);
  const keptA = assumptions.filter((a) => a.source !== "ai_generated" || a.status !== "generated" || touchedA.has(a.id));
  const keptIds = new Set(keptA.map((a) => a.id));
  const touchedS = new Set(evidenceS.map((e) => e.id).filter((id): id is string => !!id));
  const keptS = stakeholders.filter((s) => s.source !== "ai_generated" || touchedS.has(s.id) || links.some((l) => l.stakeholderId === s.id && keptIds.has(l.assumptionId)));
  return {
    assumptions: keptA.map(({ id, title, status }) => ({ id, title, status })),
    stakeholders: keptS.map(({ id, roleName }) => ({ id, roleName })),
  };
}

/**
 * Creates a run, or returns the one that already covers this request.
 * One project can have only one pending or running row. The lock and the partial unique index
 * make two clicks, two tabs, or two servers share that row instead of starting two jobs.
 * `force` is regeneration: a finished initial run must not be returned in place of a new one.
 * A pending row is started again, so a process that died before launch can be picked up.
 * A failed row with the same key is reopened.
 */
export async function startRun(
  projectId: string,
  kind: "initial" | "refine",
  input: unknown,
  idempotencyKey: string,
  opts?: { force?: boolean },
): Promise<{ run: Run; started: boolean }> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${projectId})::bigint)`);
    const staleBefore = new Date(Date.now() - STALE_MS);
    await tx
      .update(generationRun)
      .set({ status: "failed", error: "The run did not finish (server restarted or timed out). Retry generation.", finishedAt: new Date() })
      .where(and(eq(generationRun.projectId, projectId), ne(generationRun.kind, "extract"), inArray(generationRun.status, ["pending", "running"]), lt(generationRun.createdAt, staleBefore)));

    const [busy] = await tx
      .select()
      .from(generationRun)
      .where(and(eq(generationRun.projectId, projectId), ne(generationRun.kind, "extract"), inArray(generationRun.status, ["pending", "running"])))
      .limit(1);
    if (busy) return { run: busy, started: busy.status === "pending" };

    if (kind === "initial" && !opts?.force) {
      const [done] = await tx
        .select()
        .from(generationRun)
        .where(and(eq(generationRun.projectId, projectId), eq(generationRun.kind, "initial"), eq(generationRun.status, "completed")))
        .limit(1);
      if (done) return { run: done, started: false };
    }

    const inserted = await tx
      .insert(generationRun)
      .values({ projectId, kind, idempotencyKey, input: input as object, status: "pending" })
      .onConflictDoNothing({ target: [generationRun.projectId, generationRun.kind, generationRun.idempotencyKey] })
      .returning();
    if (inserted[0]) return { run: inserted[0], started: true };

    const [same] = await tx
      .select()
      .from(generationRun)
      .where(and(eq(generationRun.projectId, projectId), eq(generationRun.kind, kind), eq(generationRun.idempotencyKey, idempotencyKey)));
    if (!same) throw new Error("generation run conflict could not be reloaded");
    if (same.status === "failed") {
      const [again] = await tx
        .update(generationRun)
        .set({ status: "pending", error: null, finishedAt: null, startedAt: null })
        .where(eq(generationRun.id, same.id))
        .returning();
      return { run: again!, started: true };
    }
    return { run: same, started: same.status === "pending" };
  });
}

/** Fire and forget. Errors are stored on the run, never thrown to the caller. */
export function launch(runId: string) {
  if (active.has(runId)) return;
  const controller = new AbortController();
  stops.set(runId, controller);
  active.add(runId);
  void executeRun(runId, controller.signal)
    .catch((e) => console.error("[generation] unexpected", e instanceof Error ? e.message : e))
    .finally(() => {
      active.delete(runId);
      stops.delete(runId);
    });
}

/** Marks the active run stopped and aborts the model call. A stopped run does not save new rows. */
export async function stopRun(projectId: string): Promise<Run | null> {
  const runs = await db()
    .update(generationRun)
    .set({ status: "failed", error: "Stopped", finishedAt: new Date() })
    .where(and(eq(generationRun.projectId, projectId), ne(generationRun.kind, "extract"), inArray(generationRun.status, ["pending", "running"])))
    .returning();
  for (const run of runs) stops.get(run.id)?.abort();
  return runs[0] ?? null;
}

async function fail(runId: string, error: string, attempts = 0) {
  await db()
    .update(generationRun)
    .set({ status: "failed", error: error.slice(0, 500), attempts, finishedAt: new Date() })
    .where(and(eq(generationRun.id, runId), eq(generationRun.status, "running")));
}

export async function executeRun(runId: string, signal?: AbortSignal): Promise<void> {
  const [run] = await db()
    .update(generationRun)
    .set({ status: "running", startedAt: new Date(), error: null })
    .where(and(eq(generationRun.id, runId), eq(generationRun.status, "pending")))
    .returning();
  if (!run || run.kind === "extract") return;
  let attempts = 0;
  try {
    const p = await loadPromptProject(run.projectId);
    if (p.idea.trim().length < 10) throw new Error("The project has no description to work from");
    const input = (run.input ?? {}) as {
      dimensions?: string[];
      notes?: Record<string, string>;
      extras?: boolean;
      aspects?: string[];
      note?: string;
      learning?: string;
      answers?: { question: string; answer: string }[];
    };
    const replace = input.extras === true;
    const kept = replace ? await listKept(run.projectId) : null;
    const [allAssumptions, allStakeholders] = kept
      ? [kept.assumptions, kept.stakeholders]
      : await Promise.all([
          db().select({ id: assumption.id, title: assumption.title, status: assumption.status }).from(assumption).where(eq(assumption.projectId, run.projectId)).orderBy(asc(assumption.createdAt)),
          db().select({ id: stakeholder.id, roleName: stakeholder.roleName }).from(stakeholder).where(eq(stakeholder.projectId, run.projectId)).orderBy(asc(stakeholder.createdAt)),
        ]);
    const existingAssumptions = allAssumptions;
    const existingStakeholders = allStakeholders;
    const stakeholderKeys = existingStakeholders.map((s, i) => ({ key: `e${i + 1}`, ...s }));
    const examples = selectExamples(`${p.name} ${p.idea} ${p.context} ${p.audience ?? ""}`);
    const prompt = buildGenerationPrompt({
      mode: run.kind,
      project: p,
      examples,
      existingAssumptions: existingAssumptions.map((a, i) => ({ key: `x${i + 1}`, title: a.title, status: a.status })),
      existingStakeholders: stakeholderKeys.map((s) => ({ key: s.key, roleName: s.roleName })),
      refine: run.kind === "refine" ? { dimensions: input.dimensions ?? [], notes: input.notes ?? {}, learning: input.learning ?? "", answers: input.answers ?? [] } : undefined,
      focus: run.kind === "initial" ? { aspects: input.aspects ?? [], note: input.note ?? "" } : undefined,
    });
    const out = await glmJson(
      generationOutputSchema({ existingStakeholderKeys: stakeholderKeys.map((s) => s.key), mode: run.kind }),
      { system: prompt.system, user: prompt.user, maxTokens: 8000, signal },
    );
    if (signal?.aborted) return;
    attempts = out.attempts;
    const result = await persist({
      hold: replace,
      replace,
      run,
      out: out.data,
      audienceUnconfirmed: !(p.audienceState === "confirmed" || p.audienceState === "detected"),
      stakeholderKeyToId: new Map(stakeholderKeys.map((s) => [s.key, s.id])),
      model: out.model,
      examples: examples.map((e) => e.id),
      attempts,
    });
    if (replace && !signal?.aborted) {
      const more = await generateExtras(run.projectId, p, signal);
      await db()
        .update(generationRun)
        .set({ status: "completed", result: { ...result, extras: more }, finishedAt: new Date() })
        .where(and(eq(generationRun.id, runId), eq(generationRun.status, "running")));
    }
  } catch (e) {
    if (signal?.aborted || (e instanceof Error && e.name === "AbortError")) return;
    const message = e instanceof Error ? e.message : String(e);
    if (message === "This generation was superseded") return;
    await fail(runId, message, attempts);
  }
}

/** Untouched AI rows only. User-written rows, and anything with evidence or a decision, stay. */
async function deleteReplaceable(tx: Pick<ReturnType<typeof db>, "delete" | "select">, projectId: string) {
  await tx.delete(assumption).where(
    and(
      eq(assumption.projectId, projectId),
      eq(assumption.source, "ai_generated"),
      eq(assumption.status, "generated"),
      notExists(tx.select({ x: assumptionEvidence.id }).from(assumptionEvidence).where(eq(assumptionEvidence.assumptionId, assumption.id))),
      notExists(tx.select({ x: assumptionDecision.id }).from(assumptionDecision).where(eq(assumptionDecision.assumptionId, assumption.id))),
    ),
  );
  await tx.delete(stakeholder).where(
    and(
      eq(stakeholder.projectId, projectId),
      eq(stakeholder.source, "ai_generated"),
      notExists(tx.select({ x: assumptionEvidence.id }).from(assumptionEvidence).where(eq(assumptionEvidence.stakeholderId, stakeholder.id))),
      notExists(tx.select({ x: assumptionStakeholder.assumptionId }).from(assumptionStakeholder).where(eq(assumptionStakeholder.stakeholderId, stakeholder.id))),
    ),
  );
}

async function persist(a: {
  /** keep the run open: the caller finishes it after the follow-up steps */
  hold: boolean;
  /** regeneration: drop untouched AI rows in this same transaction, then insert the new ones */
  replace: boolean;
  run: Run;
  out: GenerationOutput;
  audienceUnconfirmed: boolean;
  stakeholderKeyToId: Map<string, string>;
  model: string;
  examples: string[];
  attempts: number;
}) {
  const { run, out } = a;
  const projectId = run.projectId;
  return db().transaction(async (tx) => {
    if (a.replace) await deleteReplaceable(tx, projectId);
    const prior = await tx.select({ id: assumption.id, title: assumption.title, status: assumption.status }).from(assumption).where(eq(assumption.projectId, projectId));
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

    const existing = [...prior];
    const aMap = new Map<string, string>();
    for (const x of out.assumptions) {
      const near = prior.find((t) => similarity(t.title, x.title) >= NEAR_DUPLICATE);
      if (near) {
        aMap.set(x.id, near.id);
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
        prior.push({ id: ins[0].id, title: x.title, status: "generated" });
        res.created.assumptions++;
      } else {
        const dedupeKey = normalizeKey(x.title);
        const [ex] = await tx.select({ id: assumption.id }).from(assumption).where(and(eq(assumption.projectId, projectId), eq(assumption.dedupeKey, dedupeKey)));
        if (ex) aMap.set(x.id, ex.id);
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
      for (const x of existing) {
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

    const [saved] = await tx
      .update(generationRun)
      .set({
        status: a.hold ? "running" : "completed",
        summary: out.generationSummary,
        result: res,
        model: a.model,
        examples: a.examples,
        attempts: a.attempts,
        error: null,
        finishedAt: a.hold ? null : new Date(),
      })
      .where(and(eq(generationRun.id, run.id), eq(generationRun.status, "running")))
      .returning({ id: generationRun.id });
    if (!saved) throw new Error("This generation was superseded");
    return res;
  });
}

