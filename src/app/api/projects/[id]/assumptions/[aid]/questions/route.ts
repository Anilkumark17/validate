import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { neutralQuestion } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { replaceGuide } from "@/server/board/guides";
import { GlmError, glmJson } from "@/server/board/glm";
import { requireAssumption } from "@/server/board/queries";
import { db, schema } from "@/server/db";
import { ApiError, handle, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const questionsOutput = z.object({
  questions: z.array(neutralQuestion).min(2).max(6),
});

/**
 * Rewrites this assumption's questions from its current wording, then rebuilds any interview
 * guide that listed it. Called only after the person accepts an assumption change.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string; aid: string }> }) => {
  rateLimit(req, "align_questions", 8);
  const { id, aid } = await ctx.params;
  await requireProject(req, id);
  const a = await requireAssumption(id, aid);
  const prompt = {
    system: `You rewrite interview questions so they test one assumption. Output JSON only: {"questions":[string]}.
Rules: 2 to 4 questions. Each asks about a specific past event or behavior ("Tell me about the last time..."). No hypotheticals, no "would you", no "do you think", no opinions. Do not invent facts. Do not say the assumption is true or false.`,
    user: `Assumption title: ${a.title}\nStatement: ${a.description}\nHow it would be checked: ${a.validationMethod}\nSuccess: ${a.successCriteria}\n\nWrite the questions.`,
  };
  let questions: string[];
  try {
    const { data } = await glmJson(questionsOutput, { system: prompt.system, user: prompt.user, maxTokens: 1200, temperature: 0.3, signal: req.signal });
    if (req.signal.aborted) return NextResponse.json({ stopped: true, questions: a.validationQuestions, guidesRewritten: 0 });
    questions = data.questions;
  } catch (e) {
    if (req.signal.aborted || (e instanceof Error && e.name === "AbortError")) {
      return NextResponse.json({ stopped: true, questions: a.validationQuestions, guidesRewritten: 0 });
    }
    if (e instanceof GlmError) throw new ApiError(502, "questions_failed", e.message);
    throw e;
  }
  await db().update(schema.assumption).set({ validationQuestions: questions, updatedAt: new Date() }).where(eq(schema.assumption.id, aid));

  const guides = await db().select({ stakeholderId: schema.interviewGuide.stakeholderId, assumptionIds: schema.interviewGuide.assumptionIds }).from(schema.interviewGuide).where(eq(schema.interviewGuide.projectId, id));
  const stakeholders = [...new Set(guides.filter((g) => g.stakeholderId && g.assumptionIds.includes(aid)).map((g) => g.stakeholderId!))];
  let guidesRewritten = 0;
  for (const sid of stakeholders) {
    if (req.signal.aborted) break;
    try {
      await replaceGuide(id, sid, req.signal);
      guidesRewritten++;
    } catch {
      // One role can fail without discarding the questions already saved on the assumption.
    }
  }
  return NextResponse.json({ questions, guidesRewritten });
});
