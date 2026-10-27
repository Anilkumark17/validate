import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { handle, parseBody } from "@/server/http";
import { projectInput } from "@/lib/schemas";

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
  return NextResponse.json(projects.map((p) => ({ ...p, meetingCount: meetings.find((m) => m.projectId === p.id)?.n ?? 0 })));
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const v = await parseBody(req, projectInput);
  const [p] = await db().insert(schema.project).values({ ...v, ownerId: user.id }).returning();
  return NextResponse.json(p, { status: 201 });
});
