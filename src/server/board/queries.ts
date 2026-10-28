import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { computeProgress, type Status } from "@/lib/board/constants";
import { ApiError, isUuid, notFound } from "../http";
import { db, schema } from "../db";

const { assumption, stakeholder, assumptionStakeholder, assumptionEvidence, assumptionDecision, appUser } = schema;

/** Progress comes from the assumption rows every time. No stored percentage exists to drift. */
export async function getProgress(projectId: string) {
  const rows = await db()
    .select({ status: assumption.status, n: sql<number>`count(*)::int` })
    .from(assumption)
    .where(eq(assumption.projectId, projectId))
    .groupBy(assumption.status);
  const by: Partial<Record<Status, number>> = {};
  for (const r of rows) by[r.status as Status] = r.n;
  return computeProgress(by);
}

export async function getBoard(projectId: string) {
  const [assumptions, stakeholders, links, evidenceByAssumption, interviewByStakeholder, evidenceByStakeholder] = await Promise.all([
    db().select().from(assumption).where(eq(assumption.projectId, projectId)).orderBy(desc(assumption.risk), asc(assumption.createdAt)),
    db().select().from(stakeholder).where(eq(stakeholder.projectId, projectId)).orderBy(desc(stakeholder.relevance), asc(stakeholder.createdAt)),
    db().select({ a: assumptionStakeholder.assumptionId, s: assumptionStakeholder.stakeholderId }).from(assumptionStakeholder).where(eq(assumptionStakeholder.projectId, projectId)),
    db()
      .select({ id: assumptionEvidence.assumptionId, n: sql<number>`count(*)::int` })
      .from(assumptionEvidence)
      .where(eq(assumptionEvidence.projectId, projectId))
      .groupBy(assumptionEvidence.assumptionId),
    db()
      .select({ id: assumptionEvidence.stakeholderId, n: sql<number>`count(*)::int` })
      .from(assumptionEvidence)
      .where(and(eq(assumptionEvidence.projectId, projectId), eq(assumptionEvidence.type, "interview")))
      .groupBy(assumptionEvidence.stakeholderId),
    db()
      .select({ id: assumptionEvidence.stakeholderId, n: sql<number>`count(*)::int` })
      .from(assumptionEvidence)
      .where(eq(assumptionEvidence.projectId, projectId))
      .groupBy(assumptionEvidence.stakeholderId),
  ]);
  const evCount = new Map(evidenceByAssumption.map((r) => [r.id, r.n]));
  const ivCount = new Map(interviewByStakeholder.map((r) => [r.id, r.n]));
  const evByS = new Map(evidenceByStakeholder.map((r) => [r.id, r.n]));
  const sOf = new Map<string, string[]>();
  const aOf = new Map<string, string[]>();
  for (const l of links) {
    sOf.set(l.a, [...(sOf.get(l.a) ?? []), l.s]);
    aOf.set(l.s, [...(aOf.get(l.s) ?? []), l.a]);
  }
  const by: Partial<Record<Status, number>> = {};
  for (const a of assumptions) by[a.status as Status] = (by[a.status as Status] ?? 0) + 1;
  return {
    progress: computeProgress(by),
    assumptions: assumptions.map((a) => ({ ...a, stakeholderIds: sOf.get(a.id) ?? [], evidenceCount: evCount.get(a.id) ?? 0 })),
    stakeholders: stakeholders.map((s) => ({
      ...s,
      assumptionIds: aOf.get(s.id) ?? [],
      interviewCount: ivCount.get(s.id) ?? 0,
      evidenceCount: evByS.get(s.id) ?? 0,
    })),
  };
}

export async function requireAssumption(projectId: string, assumptionId: string) {
  if (!isUuid(assumptionId)) throw notFound("Assumption");
  const [a] = await db().select().from(assumption).where(and(eq(assumption.id, assumptionId), eq(assumption.projectId, projectId)));
  if (!a) throw notFound("Assumption");
  return a;
}

export async function requireStakeholder(projectId: string, stakeholderId: string) {
  if (!isUuid(stakeholderId)) throw notFound("Stakeholder");
  const [s] = await db().select().from(stakeholder).where(and(eq(stakeholder.id, stakeholderId), eq(stakeholder.projectId, projectId)));
  if (!s) throw notFound("Stakeholder");
  return s;
}

/** Ids must exist in the same project. Returns them de-duplicated. */
export async function assertStakeholdersInProject(projectId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return unique;
  const rows = await db().select({ id: stakeholder.id }).from(stakeholder).where(and(eq(stakeholder.projectId, projectId), inArray(stakeholder.id, unique)));
  if (rows.length !== unique.length) throw new ApiError(400, "bad_stakeholder", "A stakeholder does not belong to this project");
  return unique;
}

export async function assertAssumptionsInProject(projectId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return unique;
  const rows = await db().select({ id: assumption.id }).from(assumption).where(and(eq(assumption.projectId, projectId), inArray(assumption.id, unique)));
  if (rows.length !== unique.length) throw new ApiError(400, "bad_assumption", "An assumption does not belong to this project");
  return unique;
}

export async function getAssumptionDetail(projectId: string, assumptionId: string) {
  const a = await requireAssumption(projectId, assumptionId);
  const [linked, evidence, decisions] = await Promise.all([
    db()
      .select({ id: stakeholder.id })
      .from(assumptionStakeholder)
      .innerJoin(stakeholder, eq(stakeholder.id, assumptionStakeholder.stakeholderId))
      .where(eq(assumptionStakeholder.assumptionId, a.id)),
    db()
      .select({ e: assumptionEvidence, role: stakeholder.roleName })
      .from(assumptionEvidence)
      .leftJoin(stakeholder, eq(stakeholder.id, assumptionEvidence.stakeholderId))
      .where(eq(assumptionEvidence.assumptionId, a.id))
      .orderBy(desc(assumptionEvidence.researchedOn), desc(assumptionEvidence.createdAt)),
    db()
      .select({ d: assumptionDecision, actor: appUser.name })
      .from(assumptionDecision)
      .leftJoin(appUser, eq(appUser.id, assumptionDecision.actorId))
      .where(eq(assumptionDecision.assumptionId, a.id))
      .orderBy(desc(assumptionDecision.createdAt)),
  ]);
  return {
    assumption: a,
    stakeholderIds: linked.map((l) => l.id),
    evidence: evidence.map((r) => ({ ...r.e, stakeholderRole: r.role })),
    decisions: decisions.map((r) => ({ ...r.d, actorName: r.actor })),
  };
}

export async function listEvidence(projectId: string) {
  const rows = await db()
    .select({ e: assumptionEvidence, role: stakeholder.roleName, title: assumption.title })
    .from(assumptionEvidence)
    .innerJoin(assumption, eq(assumption.id, assumptionEvidence.assumptionId))
    .leftJoin(stakeholder, eq(stakeholder.id, assumptionEvidence.stakeholderId))
    .where(eq(assumptionEvidence.projectId, projectId))
    .orderBy(desc(assumptionEvidence.researchedOn), desc(assumptionEvidence.createdAt));
  return rows.map((r) => ({ ...r.e, stakeholderRole: r.role, assumptionTitle: r.title }));
}

export async function listDecisions(projectId: string) {
  const rows = await db()
    .select({ d: assumptionDecision, title: assumption.title, actor: appUser.name })
    .from(assumptionDecision)
    .innerJoin(assumption, eq(assumption.id, assumptionDecision.assumptionId))
    .leftJoin(appUser, eq(appUser.id, assumptionDecision.actorId))
    .where(eq(assumptionDecision.projectId, projectId))
    .orderBy(desc(assumptionDecision.createdAt));
  return rows.map((r) => ({ ...r.d, assumptionTitle: r.title, actorName: r.actor }));
}

