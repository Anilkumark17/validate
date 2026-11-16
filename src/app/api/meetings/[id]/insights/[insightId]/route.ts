import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { INSIGHT_TAGS } from "@/lib/insights/extract";
import { requireMeetingHost } from "@/server/auth";
import { db } from "@/server/db";
import { insight } from "@/server/db/schema";
import { ApiError, handle, isUuid, notFound, parseBody, rateLimit } from "@/server/http";

const body = z.object({
  action: z.enum(["confirm", "reject", "edit"]),
  reason: z.string().trim().max(300).optional(),
  summaryEn: z.string().trim().min(1).max(400).optional(),
  profileTags: z.array(z.enum(INSIGHT_TAGS)).max(8).optional(),
});

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string; insightId: string }> }) => {
  const { id, insightId } = await ctx.params;
  rateLimit(req, "insight_review", 40);
  await requireMeetingHost(req, id);
  if (!isUuid(insightId)) throw notFound("Insight");
  const input = await parseBody(req, body);
  if (input.action === "reject" && !input.reason) throw new ApiError(400, "reason_required", "A rejection needs a one-line reason");
  const [row] = await db().select().from(insight).where(and(eq(insight.id, insightId), eq(insight.meetingId, id)));
  if (!row) throw notFound("Insight");
  const patch =
    input.action === "confirm"
      ? { status: "confirmed", rejectReason: null, updatedAt: new Date() }
      : input.action === "reject"
        ? { status: "rejected", rejectReason: input.reason!, updatedAt: new Date() }
        : { summaryEn: input.summaryEn ?? row.summaryEn, profileTags: input.profileTags ?? row.profileTags, updatedAt: new Date() };
  const [saved] = await db().update(insight).set(patch).where(eq(insight.id, row.id)).returning();
  return NextResponse.json({ insight: saved });
});
