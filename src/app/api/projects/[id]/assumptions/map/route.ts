import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { mapIdea } from "@/server/llm/tasks";
import { getProject } from "@/server/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const input = z.object({
  idea: z.string().trim().max(4000).optional(),
  customer: z.string().trim().max(500).optional(),
  stage: z.enum(["idea", "prototype", "live"]).optional(),
  known: z.string().trim().max(8000).optional(),
  constraints: z.string().trim().max(1000).optional(),
  /** Feed recent call transcripts in as "what I already know" and skip assumptions already tracked. */
  fromCalls: z.boolean().optional(),
});

/** Maps an idea (and optionally live call evidence) to ranked assumptions. Does not save them. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const p = await getProject(id);
  const v = await parseBody(req, input);
  let known = v.known ?? "";
  if (v.fromCalls) {
    const meetings = await db().select({ id: schema.meeting.id }).from(schema.meeting).where(eq(schema.meeting.projectId, id));
    if (meetings.length) {
      const segs = await db()
        .select()
        .from(schema.segment)
        .where(inArray(schema.segment.meetingId, meetings.map((m) => m.id)))
        .orderBy(desc(schema.segment.createdAt))
        .limit(80);
      const transcript = segs.reverse().map((s) => `${s.speaker ?? "Unknown"}: ${s.text}`).join("\n");
      known = `${known}\nCall transcripts (customer statements are observed behavior only when they describe past actions):\n${transcript}`.trim();
    }
    const existing = await db().select({ s: schema.assumption.statement }).from(schema.assumption).where(eq(schema.assumption.projectId, id));
    if (existing.length) known += `\nAlready tracked assumptions, do not repeat them:\n${existing.map((e) => `- ${e.s}`).join("\n")}`;
  }
  const result = await mapIdea({
    idea: v.idea || [p.name, p.description].filter(Boolean).join(". "),
    customer: v.customer || p.targetUser || undefined,
    stage: v.stage,
    known: known || undefined,
    constraints: v.constraints,
  });
  return NextResponse.json(result);
});
