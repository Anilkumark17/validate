import { count, eq } from "drizzle-orm";
import { MAX_MEETING_MIN, MAX_MEETINGS, MAX_PROJECTS, MAX_MEETING_SEC, isExempt } from "@/lib/limits";
import { db, schema } from "./db";
import { ApiError } from "./http";
import { publish } from "./sse";

type Meeting = typeof schema.meeting.$inferSelect;

export async function assertCanCreateProject(user: { id: string; email: string }) {
  if (isExempt(user.email)) return;
  const [r] = await db().select({ n: count() }).from(schema.project).where(eq(schema.project.ownerId, user.id));
  if ((r?.n ?? 0) >= MAX_PROJECTS) {
    throw new ApiError(403, "limit_reached", `Your plan allows ${MAX_PROJECTS} project. Delete it to create another.`);
  }
}

export async function assertCanCreateMeeting(user: { id: string; email: string }) {
  if (isExempt(user.email)) return;
  const [r] = await db()
    .select({ n: count() })
    .from(schema.meeting)
    .innerJoin(schema.project, eq(schema.project.id, schema.meeting.projectId))
    .where(eq(schema.project.ownerId, user.id));
  if ((r?.n ?? 0) >= MAX_MEETINGS) {
    throw new ApiError(403, "limit_reached", `Your plan allows ${MAX_MEETINGS} meeting of ${MAX_MEETING_MIN} minutes.`);
  }
}

/**
 * A live meeting whose host is not exempt is ended once it has run MAX_MEETING_MIN minutes.
 * Called wherever a meeting is used (start, token, transcript), so a modified client cannot keep it going.
 * Costs no query until the time is actually up.
 */
export async function enforceMeetingTime(m: Meeting) {
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting already ended");
  if (m.state !== "live" || !m.startedAt || Date.now() - m.startedAt.getTime() < MAX_MEETING_SEC * 1000) return;
  const [owner] = await db()
    .select({ email: schema.appUser.email })
    .from(schema.project)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.project.ownerId))
    .where(eq(schema.project.id, m.projectId));
  if (isExempt(owner?.email)) return;
  await db()
    .update(schema.meeting)
    .set({ state: "ended", endedAt: new Date(), heldAt: new Date().toISOString().slice(0, 10) })
    .where(eq(schema.meeting.id, m.id));
  publish(m.projectId, "meeting.ended", { meetingId: m.id });
  throw new ApiError(409, "ended", `Meeting reached the ${MAX_MEETING_MIN} minute limit`);
}
