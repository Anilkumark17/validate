import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { projectBasics } from "@/lib/board/schemas";
import { requireUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const projects = await db().select().from(schema.project).where(eq(schema.project.ownerId, user.id)).orderBy(desc(schema.project.createdAt));
  const meetings = await db()
    .select({ projectId: schema.meeting.projectId, n: sql<number>`count(*)::int` })
    .from(schema.meeting)
    .innerJoin(schema.project, eq(schema.project.id, schema.meeting.projectId))
    .where(eq(schema.project.ownerId, user.id))
    .groupBy(schema.meeting.projectId);
  const assumptions = await db()
    .select({ projectId: schema.assumption.projectId, status: schema.assumption.status, n: sql<number>`count(*)::int` })
    .from(schema.assumption)
    .innerJoin(schema.project, eq(schema.project.id, schema.assumption.projectId))
    .where(eq(schema.project.ownerId, user.id))
    .groupBy(schema.assumption.projectId, schema.assumption.status);
  return NextResponse.json(
    projects.map((p) => {
      const mine = assumptions.filter((a) => a.projectId === p.id);
      const total = mine.reduce((s, a) => s + a.n, 0);
      const done = mine.filter((a) => a.status === "validated" || a.status === "invalidated").reduce((s, a) => s + a.n, 0);
      return {
        ...p,
        meetingCount: meetings.find((m) => m.projectId === p.id)?.n ?? 0,
        assumptionTotal: total,
        progressPercent: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    }),
  );
});

/** Creation asks only for a name and the idea. Audience and generation happen on the next step. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const v = await parseBody(req, projectBasics);
  const [p] = await db().insert(schema.project).values({ name: v.name, description: v.idea, ownerId: user.id }).returning();
  return NextResponse.json(p, { status: 201 });
});
