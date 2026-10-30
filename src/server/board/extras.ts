import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { createGuide } from "./guides";
import { glmJson } from "./glm";
import type { PromptProject } from "./prompts";

/** At most this many interview guides are written per regeneration, for the most important roles. */
const MAX_GUIDES = 3;

const short = (min: number, max: number) => z.string().trim().min(min).max(max);

const personaOutput = z.object({
  personas: z
    .array(
      z.object({
        name: short(3, 120),
        summary: short(10, 600),
        jtbdSummary: short(10, 600),
        mindsetSummary: short(10, 600),
        segmentHints: z.array(short(2, 60)).max(6).default([]),
        systemPrompt: short(40, 4000),
      }),
    )
    .min(1)
    .max(5),
});

export interface ExtrasResult {
  personas: number;
  guides: number;
  /** steps that failed. The assumptions and stakeholders are already saved. */
  failed: string[];
}

function personaPrompt(p: PromptProject, assumptions: string[], roles: string[]) {
  return {
    system: `You design AI customer personas for early product discovery. Output ONE JSON object only.
Rules: Personas are hypotheses about likely customer types, built from the project idea, the owner's notes and the assumptions listed. They are NOT research findings: never state statistics or claim anything was learned from real customers. If the audience is unconfirmed, keep personas broad and say so in the summary. Give 3 or 4 clearly different personas.
Each persona has: "name" (a short archetype label, not a real person), "summary" (who they are in two sentences), "jtbdSummary" (the jobs they hire a product for, two or three sentences), "mindsetSummary" (how they decide, how risk-averse they are, what they believe, two or three sentences), "segmentHints" (up to 4 short tags) and "systemPrompt" (instructions that make an AI play this customer in a conversation: their situation, goals, frustrations, how they talk, what they push back on, and that they must answer from this profile and say when they do not know).
Shape: {"personas":[{"name":string,"summary":string,"jtbdSummary":string,"mindsetSummary":string,"segmentHints":[string],"systemPrompt":string}]}`,
    user: `Project: ${p.name}\n<idea>\n${p.idea.slice(0, 3000)}\n</idea>\nAudience: ${p.audience ?? "not confirmed"}\n${
      p.context.trim() ? `<project_notes>\n${p.context.slice(0, 4000)}\n</project_notes>\n` : ""
    }Stakeholder roles: ${JSON.stringify(roles)}\nAssumptions to validate: ${JSON.stringify(assumptions)}\n\nWrite the personas.`,
  };
}

/** Replaces the AI drafts. Approved and user-created personas stay. */
async function makePersonas(projectId: string, p: PromptProject): Promise<number> {
  const [assumptions, roles] = await Promise.all([
    db().select({ title: schema.assumption.title }).from(schema.assumption).where(eq(schema.assumption.projectId, projectId)).orderBy(sql`${schema.assumption.risk} desc nulls last`).limit(12),
    db().select({ roleName: schema.stakeholder.roleName }).from(schema.stakeholder).where(eq(schema.stakeholder.projectId, projectId)).orderBy(asc(schema.stakeholder.createdAt)),
  ]);
  const prompt = personaPrompt(p, assumptions.map((a) => a.title), roles.map((r) => r.roleName));
  const { data } = await glmJson(personaOutput, { system: prompt.system, user: prompt.user, maxTokens: 6000 });
  await db()
    .insert(schema.persona)
    .values(data.personas.map((x) => ({ projectId, source: "ai_generated" as const, status: "draft" as const, ...x })));
  return data.personas.length;
}

/** Interview guides for the roles that matter most. Roles with no linked assumptions are skipped. */
async function makeGuides(projectId: string): Promise<{ made: number; failed: number }> {
  const roles = await db()
    .select({ id: schema.stakeholder.id })
    .from(schema.stakeholder)
    .where(eq(schema.stakeholder.projectId, projectId))
    .orderBy(
      sql`case ${schema.stakeholder.interviewPriority} when 'high' then 0 when 'medium' then 1 else 2 end`,
      sql`${schema.stakeholder.relevance} desc`,
    );
  const results = await Promise.allSettled(roles.slice(0, MAX_GUIDES).map((r) => createGuide(projectId, r.id)));
  const made = results.filter((r) => r.status === "fulfilled").length;
  return { made, failed: results.length - made };
}

/**
 * The steps after the assumptions and stakeholders exist. Best effort: a failure here is reported
 * on the run, and never undoes what was already saved.
 */
export async function generateExtras(projectId: string, p: PromptProject): Promise<ExtrasResult> {
  const out: ExtrasResult = { personas: 0, guides: 0, failed: [] };
  const [persona, guides] = await Promise.allSettled([makePersonas(projectId, p), makeGuides(projectId)]);
  if (persona.status === "fulfilled") out.personas = persona.value;
  else out.failed.push("personas");
  if (guides.status === "fulfilled") {
    out.guides = guides.value.made;
    if (guides.value.failed > 0) out.failed.push(`${guides.value.failed} interview guide(s)`);
  } else out.failed.push("interview guides");
  return out;
}
