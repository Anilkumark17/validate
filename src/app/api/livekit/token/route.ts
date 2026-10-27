import { randomBytes } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { addGuestMeeting, requireMeetingAccess } from "@/server/auth";
import { env } from "@/server/env";
import { ApiError, handle, parseBody } from "@/server/http";
import { getMeetingByCode } from "@/server/queries";
import { tokenInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * An invite code grants guest access to that one meeting (and sets the guest cookie).
 * A meetingId needs the host session or an earlier guest join.
 */
export const POST = handle(async (req: Request) => {
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
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting has ended");
  const at = new AccessToken(e.LIVEKIT_API_KEY, e.LIVEKIT_API_SECRET, {
    identity: `${v.name}-${randomBytes(3).toString("hex")}`,
    name: v.name,
    ttl: "4h",
  });
  at.addGrant({ roomJoin: true, room: m.id, canPublish: true, canSubscribe: true });
  const res = NextResponse.json({ token: await at.toJwt(), url: e.LIVEKIT_URL, meetingId: m.id });
  if (grantGuest) addGuestMeeting(req, res, m.id);
  return res;
});
