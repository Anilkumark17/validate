import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMeetingHost } from "@/server/auth";
import { db } from "@/server/db";
import { meeting } from "@/server/db/schema";
import { handle, parseBody, rateLimit } from "@/server/http";

const body = z.object({
  consent: z.literal(true),
  role: z.string().trim().max(120).optional(),
  segment: z.string().trim().max(120).optional(),
  stage: z.string().trim().max(120).optional(),
});

export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  rateLimit(req, "meeting_consent", 20);
  await requireMeetingHost(req, id);
  const input = await parseBody(req, body);
  const [row] = await db()
    .update(meeting)
    .set({
      consentAt: new Date(),
      customer: { role: input.role ?? "", segment: input.segment ?? "", stage: input.stage ?? "" },
    })
    .where(eq(meeting.id, id))
    .returning();
  return NextResponse.json({ meeting: row });
});
