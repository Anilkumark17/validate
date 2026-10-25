import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { projectInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const projects = await db().select().from(schema.project).orderBy(desc(schema.project.createdAt));
  const counts = await db()
    .select({
      projectId: schema.assumption.projectId,
      status: schema.assumption.status,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.assumption)
    .groupBy(schema.assumption.projectId, schema.assumption.status);
  const meetings = await db()
    .select({ projectId: schema.meeting.projectId, n: sql<number>`count(*)::int` })
    .from(schema.meeting)
    .groupBy(schema.meeting.projectId);
  return NextResponse.json(
    projects.map((p) => ({
      ...p,
      statusCounts: Object.fromEntries(counts.filter((c) => c.projectId === p.id).map((c) => [c.status, c.n])),
      meetingCount: meetings.find((m) => m.projectId === p.id)?.n ?? 0,
    })),
  );
});

export const POST = handle(async (req: Request) => {
  const v = await parseBody(req, projectInput);
  const [p] = await db().insert(schema.project).values(v).returning();
  return NextResponse.json(p, { status: 201 });
});
