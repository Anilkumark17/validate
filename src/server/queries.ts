import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { notFound, isUuid } from "./http";

export const newInviteCode = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8).toLowerCase();

export async function getProject(id: string) {
  if (!isUuid(id)) throw notFound("Project");
  const [p] = await db().select().from(schema.project).where(eq(schema.project.id, id));
  if (!p) throw notFound("Project");
  return p;
}

export async function getMeeting(id: string) {
  if (!isUuid(id)) throw notFound("Meeting");
  const [m] = await db().select().from(schema.meeting).where(eq(schema.meeting.id, id));
  if (!m) throw notFound("Meeting");
  return m;
}

export async function getMeetingByCode(code: string) {
  const [m] = await db().select().from(schema.meeting).where(eq(schema.meeting.inviteCode, code.toLowerCase()));
  if (!m) throw notFound("Invite");
  return m;
}

export async function createMeeting(
  projectId: string,
  v: Partial<typeof schema.meeting.$inferInsert> & { title: string },
) {
  for (let i = 0; i < 5; i++) {
    try {
      const [m] = await db()
        .insert(schema.meeting)
        .values({ ...v, projectId, inviteCode: newInviteCode() })
        .returning();
      return m!;
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  throw new Error("unreachable");
}
