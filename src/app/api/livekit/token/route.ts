import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { tokenInput } from "@/lib/schemas";
import { addGuestMeeting, requireMeetingAccess } from "@/server/auth";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";
import { enforceMeetingTime, isExempt } from "@/server/limits";
import { getMeetingByCode } from "@/server/queries";

export const dynamic = "force-dynamic";

/**
 * An invite code grants guest access to that one meeting (and sets the guest cookie).
 * A meetingId needs the host session or an earlier guest join.
 */
export const POST = handle(async (req: Request) => {
  rateLimit(req, "livekit_token", 30);
  const v = await parseBody(req, tokenInput);
  const e = env();
  if (!e.LIVEKIT_URL || !e.LIVEKIT_API_KEY || !e.LIVEKIT_API_SECRET) {
    throw new ApiError(500, "livekit_config", "LiveKit is not configured");
  }
  let m;
  let grantGuest = false;
  if (v.inviteCode) {
    m = await getMeetingByCode(v.inviteCode);
    grantGuest = true;
  } else if (v.meetingId) {
    m = (await requireMeetingAccess(req, v.meetingId)).meeting;
  } else {
    throw new ApiError(400, "no_meeting", "meetingId or inviteCode required");
  }
  await enforceMeetingTime(m);
  const [owner] = await db()
    .select({ email: schema.appUser.email })
    .from(schema.project)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.project.ownerId))
    .where(eq(schema.project.id, m.projectId));
  const at = new AccessToken(e.LIVEKIT_API_KEY, e.LIVEKIT_API_SECRET, {
    identity: `${v.name}-${randomBytes(3).toString("hex")}`,
    name: v.name,
    ttl: isExempt(owner?.email) ? "4h" : "45m",
  });
  at.addGrant({ roomJoin: true, room: m.id, canPublish: true, canSubscribe: true });
  const res = NextResponse.json({ token: await at.toJwt(), url: e.LIVEKIT_URL, meetingId: m.id });
  if (grantGuest) addGuestMeeting(req, res, m.id, v.name);
  return res;
});
