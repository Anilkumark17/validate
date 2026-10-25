import { randomBytes } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { ApiError, handle, parseBody } from "@/server/http";
import { getMeeting, getMeetingByCode } from "@/server/queries";
import { tokenInput } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const v = await parseBody(req, tokenInput);
  const e = env();
  if (!e.LIVEKIT_URL || !e.LIVEKIT_API_KEY || !e.LIVEKIT_API_SECRET) {
    throw new ApiError(500, "livekit_config", "LiveKit is not configured");
  }
  const m = v.meetingId ? await getMeeting(v.meetingId) : v.inviteCode ? await getMeetingByCode(v.inviteCode) : null;
  if (!m) throw new ApiError(400, "no_meeting", "meetingId or inviteCode required");
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting has ended");
  const at = new AccessToken(e.LIVEKIT_API_KEY, e.LIVEKIT_API_SECRET, {
    identity: `${v.name}-${randomBytes(3).toString("hex")}`,
    name: v.name,
    ttl: "4h",
  });
  at.addGrant({ roomJoin: true, room: m.id, canPublish: true, canSubscribe: true });
  return NextResponse.json({ token: await at.toJwt(), url: e.LIVEKIT_URL, meetingId: m.id });
});
