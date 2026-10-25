import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "./db";
import { env } from "./env";
import { describeImage, analyzeSegments } from "./llm/tasks";
import { queue } from "./queue";
import { publish } from "./sse";
import { computeStatus } from "./status";

const { segment, evidence, link, assumption, meeting, statusEvent } = schema;

const BATCH_SIZE = 8;
const BATCH_WAIT_MS = 20_000;

const g = globalThis as unknown as { __timers?: Map<string, NodeJS.Timeout>; __running?: Set<string> };
const timers = (g.__timers ??= new Map());
const running = (g.__running ??= new Set());

async function projectIdOf(meetingId: string): Promise<string> {
  const [m] = await db().select({ projectId: meeting.projectId }).from(meeting).where(eq(meeting.id, meetingId));
  if (!m) throw new Error("meeting not found");
  return m.projectId;
}

export async function addSegment(meetingId: string, input: { speaker: string; text: string; startSec?: number | null }) {
  const projectId = await projectIdOf(meetingId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ next }] = await db()
      .select({ next: sql<number>`coalesce(max(${segment.idx}), -1) + 1` })
      .from(segment)
      .where(eq(segment.meetingId, meetingId));
    try {
      const [row] = await db()
        .insert(segment)
        .values({ meetingId, idx: Number(next), speaker: input.speaker, text: input.text, startSec: input.startSec ?? null })
        .returning();
      publish(projectId, "segment.added", { meetingId, segment: row });
      scheduleBatch(meetingId);
      return row!;
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
  throw new Error("unreachable");
}

export async function insertSegments(meetingId: string, items: { speaker: string | null; text: string; startSec?: number | null }[]) {
  if (items.length === 0) return;
  await db()
    .insert(segment)
    .values(items.map((s, i) => ({ meetingId, idx: i, speaker: s.speaker, text: s.text, startSec: s.startSec ?? null })));
}

async function unprocessedCount(meetingId: string) {
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(segment)
    .where(and(eq(segment.meetingId, meetingId), eq(segment.processed, false)));
  return Number(n);
}

export function scheduleBatch(meetingId: string) {
  void (async () => {
    const n = await unprocessedCount(meetingId);
    if (n >= BATCH_SIZE) {
      clearTimeout(timers.get(meetingId));
      timers.delete(meetingId);
      enqueueMeeting(meetingId);
    } else if (n > 0 && !timers.has(meetingId)) {
      timers.set(
        meetingId,
        setTimeout(() => {
          timers.delete(meetingId);
          enqueueMeeting(meetingId);
        }, BATCH_WAIT_MS),
      );
    }
  })().catch((e) => console.error("[pipeline] schedule", e));
}

export function enqueueMeeting(meetingId: string) {
  queue.push(() => runMeeting(meetingId));
}

/** Processes all unprocessed segments in batches. One run per meeting at a time. */
export async function runMeeting(meetingId: string): Promise<void> {
  if (running.has(meetingId)) return;
  running.add(meetingId);
  let projectId = "";
  try {
    projectId = await projectIdOf(meetingId);
    for (;;) {
      const batch = await db()
        .select()
        .from(segment)
        .where(and(eq(segment.meetingId, meetingId), eq(segment.processed, false)))
        .orderBy(asc(segment.idx))
        .limit(BATCH_SIZE);
      if (batch.length === 0) break;
      publish(projectId, "pipeline.state", { meetingId, state: "analyzing" });
      await db().update(meeting).set({ jobStatus: "processing", jobError: null }).where(eq(meeting.id, meetingId));
      await processBatch(meetingId, projectId, batch);
    }
    await db().update(meeting).set({ jobStatus: "done" }).where(eq(meeting.id, meetingId));
    publish(projectId, "pipeline.state", { meetingId, state: "idle" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db().update(meeting).set({ jobStatus: "failed", jobError: message }).where(eq(meeting.id, meetingId)).catch(() => {});
    if (projectId) publish(projectId, "pipeline.error", { meetingId, message });
  } finally {
    running.delete(meetingId);
  }
}

async function loadAssumptions(projectId: string) {
  return db()
    .select({ id: assumption.id, statement: assumption.statement, type: assumption.type, status: assumption.status })
    .from(assumption)
    .where(eq(assumption.projectId, projectId))
    .limit(30);
}

async function processBatch(meetingId: string, projectId: string, batch: (typeof segment.$inferSelect)[]) {
  const assumptions = await loadAssumptions(projectId);
  const firstIdx = batch[0]!.idx;
  const prior = await db()
    .select()
    .from(segment)
    .where(and(eq(segment.meetingId, meetingId), eq(segment.processed, true), lt(segment.idx, firstIdx)))
    .orderBy(desc(segment.idx))
    .limit(2);
  prior.reverse();

  const results =
    assumptions.length === 0
      ? []
      : await analyzeSegments({
          meetingId,
          assumptions,
          priorContext: prior.map((s) => ({ idx: s.idx, speaker: s.speaker, text: s.text })),
          segments: batch.map((s) => ({ idx: s.idx, speaker: s.speaker, text: s.text })),
        });

  const segByIdx = new Map(batch.map((s) => [s.idx, s]));
  const touched = new Set<string>();
  for (const item of results) {
    const seg = segByIdx.get(item.segmentIdx)!;
    const [ev] = await db()
      .insert(evidence)
      .values({ meetingId, segmentId: seg.id, claim: item.claim, quote: item.quote, speaker: seg.speaker })
      .returning();
    const links = await db()
      .insert(link)
      .values(
        item.links.map((l) => ({
          evidenceId: ev!.id,
          assumptionId: l.assumptionId,
          stance: l.stance,
          strength: l.strength,
          rationale: l.rationale,
        })),
      )
      .onConflictDoNothing()
      .returning();
    for (const l of links) touched.add(l.assumptionId);
    publish(projectId, "evidence.added", { meetingId, evidence: ev, links, segment: seg });
  }
  await db()
    .update(segment)
    .set({ processed: true })
    .where(inArray(segment.id, batch.map((s) => s.id)));
  await recomputeAssumptions(projectId, [...touched], meetingId);
}

export async function recomputeAssumptions(projectId: string, assumptionIds: string[], meetingId: string | null) {
  for (const id of assumptionIds) {
    const [a] = await db().select().from(assumption).where(eq(assumption.id, id));
    if (!a) continue;
    const rows = await db()
      .select({ stance: link.stance, strength: link.strength, rejected: link.rejected, speaker: evidence.speaker })
      .from(link)
      .innerJoin(evidence, eq(evidence.id, link.evidenceId))
      .where(eq(link.assumptionId, id));
    const r = computeStatus(rows);
    const changed = r.status !== a.status || Math.abs(r.confidence - a.confidence) > 0.001;
    if (!changed) continue;
    const [updated] = await db()
      .update(assumption)
      .set({ status: r.status, confidence: r.confidence, updatedAt: new Date() })
      .where(eq(assumption.id, id))
      .returning();
    const reason = `${r.support} support from ${r.supportSpeakers} speaker${r.supportSpeakers === 1 ? "" : "s"}, ${r.contradict} against from ${r.contradictSpeakers}`;
    const [ev] = await db()
      .insert(statusEvent)
      .values({ assumptionId: id, meetingId, fromStatus: a.status, toStatus: r.status, confidence: r.confidence, reason })
      .returning();
    publish(projectId, "assumption.updated", { meetingId, assumption: updated, event: ev });
  }
}

export async function processFrame(args: {
  meetingId: string;
  buffer: Buffer;
  mimeType: string;
  sharedBy: string | null;
}) {
  const projectId = await projectIdOf(args.meetingId);
  const dir = path.resolve(env().UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const ext = args.mimeType.includes("png") ? "png" : args.mimeType.includes("webp") ? "webp" : "jpg";
  const name = `${args.meetingId}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, name), args.buffer);
  const imageUrl = `/api/uploads/${name}`;

  const assumptions = await loadAssumptions(projectId);
  if (assumptions.length === 0) return { imageUrl, evidence: [] };
  publish(projectId, "pipeline.state", { meetingId: args.meetingId, state: "analyzing" });
  try {
    const out = await describeImage({
      meetingId: args.meetingId,
      imageBase64: args.buffer.toString("base64"),
      mimeType: args.mimeType,
      assumptions,
    });
    const touched = new Set<string>();
    const created = [];
    for (const e of out.evidence) {
      const [ev] = await db()
        .insert(evidence)
        .values({ meetingId: args.meetingId, imageUrl, claim: e.claim, speaker: args.sharedBy ?? "Screen share" })
        .returning();
      const links = await db()
        .insert(link)
        .values(
          e.links.map((l) => ({
            evidenceId: ev!.id,
            assumptionId: l.assumptionId,
            stance: l.stance,
            strength: l.strength,
            rationale: l.rationale,
          })),
        )
        .onConflictDoNothing()
        .returning();
      links.forEach((l) => touched.add(l.assumptionId));
      created.push(ev);
      publish(projectId, "evidence.added", { meetingId: args.meetingId, evidence: ev, links });
    }
    await recomputeAssumptions(projectId, [...touched], args.meetingId);
    publish(projectId, "pipeline.state", { meetingId: args.meetingId, state: "idle" });
    return { imageUrl, evidence: created, summary: out.summary };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    publish(projectId, "pipeline.error", { meetingId: args.meetingId, message });
    throw e;
  }
}

/** Flush all unprocessed segments synchronously (used when a meeting ends or imports finish). */
export async function flushMeeting(meetingId: string) {
  clearTimeout(timers.get(meetingId));
  timers.delete(meetingId);
  while (running.has(meetingId)) await new Promise((r) => setTimeout(r, 200));
  await runMeeting(meetingId);
}
