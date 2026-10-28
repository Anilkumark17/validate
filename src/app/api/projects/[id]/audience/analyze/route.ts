import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { audienceAnalysis } from "@/lib/board/schemas";
import { requireProject } from "@/server/auth";
import { glmJson } from "@/server/board/glm";
import { buildAudiencePrompt } from "@/server/board/prompts";
import { db, schema } from "@/server/db";
import { ApiError, handle, rateLimit } from "@/server/http";
import { GlmError } from "@/server/board/glm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Decides whether the idea already names its audience. If it does, that is recorded as "detected"
 * (shown as coming from the description, editable). If not, returns suggestions for the one
 * clarification question. Nothing is ever recorded as confirmed here.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "audience", 20);
  const { id } = await ctx.params;
  const { project } = await requireProject(req, id);
  if (project.audienceState === "confirmed" || project.audienceState === "skipped" || project.audienceState === "detected") {
    return NextResponse.json({ needsQuestion: false, audience: project.targetUser, state: project.audienceState });
  }
  const prompt = buildAudiencePrompt({ name: project.name, idea: project.description ?? "" });
  try {
    const { data } = await glmJson(audienceAnalysis, { system: prompt.system, user: prompt.user, maxTokens: 800, temperature: 0.3 }, { validationRetries: 1 });
    if (data.audienceStated && data.statedAudience) {
      await db().update(schema.project).set({ targetUser: data.statedAudience, audienceState: "detected" }).where(eq(schema.project.id, id));
      return NextResponse.json({ needsQuestion: false, audience: data.statedAudience, state: "detected" });
    }
    return NextResponse.json({ needsQuestion: true, suggestions: data.suggestions });
  } catch (e) {
    if (e instanceof GlmError) {
      // Suggestions are a convenience. Without them the user can still type an audience or skip.
      return NextResponse.json({ needsQuestion: true, suggestions: [], warning: "Could not generate suggestions. You can type an audience or skip." });
    }
    throw new ApiError(500, "audience_failed", "Could not check the audience");
  }
});
