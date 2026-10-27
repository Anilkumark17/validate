import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle } from "@/server/http";
import { requireMeetingAccess } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { meeting } = await requireMeetingAccess(req, id);
  const { segment } = schema;
  const segments = await db().select().from(segment).where(eq(segment.meetingId, id)).orderBy(sql`${segment.startSec} asc nulls last`, asc(segment.idx));
  return NextResponse.json({ meeting, segments });
});
