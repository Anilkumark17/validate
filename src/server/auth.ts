import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, schema } from "./db";
import { ApiError, isUuid, notFound } from "./http";
import { env } from "./env";
import { getProject } from "./queries";
import { eq } from "drizzle-orm";

const SESSION_TTL_S = 7 * 24 * 3600;
const GUEST_TTL_S = 24 * 3600;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, Buffer.from(salt, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}

function secret(): string {
  const s = env().AUTH_SECRET;
  if (s.length < 32) throw new ApiError(500, "auth_config", "AUTH_SECRET must be at least 32 characters");
  return s;
}

const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

function sign(payload: Record<string, unknown>, ttlS: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlS })).toString("base64url");
  return `${body}.${mac(body)}`;
}

function verify<T>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
    return data.exp > Date.now() / 1000 ? data : null;
  } catch {
    return null;
  }
}

function cookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export function setSession(res: NextResponse, userId: string) {
  res.cookies.set("session", sign({ sub: userId }, SESSION_TTL_S), cookieOpts(SESSION_TTL_S));
}

export function clearSession(res: NextResponse) {
  res.cookies.set("session", "", { ...cookieOpts(0), maxAge: 0 });
}

type GuestToken = { m: string[]; n?: Record<string, string> };

/** Guest cookie lists the meetings this browser joined, and the name they used for each one. */
export function addGuestMeeting(req: Request, res: NextResponse, meetingId: string, name?: string) {
  const current = verify<GuestToken>(cookie(req, "guest"));
  const m = [...new Set([...(current?.m ?? []), meetingId])].slice(-20);
  const n = { ...(current?.n ?? {}) };
  if (name) n[meetingId] = name.trim().slice(0, 60);
  for (const id of Object.keys(n)) if (!m.includes(id)) delete n[id];
  res.cookies.set("guest", sign({ m, n }, GUEST_TTL_S), cookieOpts(GUEST_TTL_S));
}

function guestToken(req: Request): GuestToken {
  return verify<GuestToken>(cookie(req, "guest")) ?? { m: [] };
}

export async function currentUser(req: Request) {
  const s = verify<{ sub: string }>(cookie(req, "session"));
  if (!s) return null;
  const [u] = await db()
    .select({ id: schema.appUser.id, email: schema.appUser.email, name: schema.appUser.name })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, s.sub));
  return u ?? null;
}

export async function requireUser(req: Request) {
  const u = await currentUser(req);
  if (!u) throw new ApiError(401, "unauthenticated", "Sign in required");
  return u;
}

/** Project owner only. Other users get 404 so ids do not leak. */
export async function requireProject(req: Request, projectId: string) {
  const user = await requireUser(req);
  const p = await getProject(projectId);
  if (p.ownerId !== user.id) throw new ApiError(404, "not_found", "Project not found");
  return { user, project: p };
}

function guestMeetings(req: Request): string[] {
  return guestToken(req).m;
}

/** The project owner, or a guest who joined this meeting by invite link. The speaker name is the account name, or the name stored when the guest joined. */
export async function requireMeetingAccess(req: Request, meetingId: string) {
  if (!isUuid(meetingId)) throw notFound("Meeting");
  const [row] = await db()
    .select({ meeting: schema.meeting, ownerId: schema.project.ownerId })
    .from(schema.meeting)
    .innerJoin(schema.project, eq(schema.project.id, schema.meeting.projectId))
    .where(eq(schema.meeting.id, meetingId));
  if (!row) throw notFound("Meeting");
  const user = await currentUser(req);
  if (user && row.ownerId === user.id) return { meeting: row.meeting, host: true as const, speaker: user.name };
  if (guestMeetings(req).includes(row.meeting.id)) {
    const named = guestToken(req).n?.[row.meeting.id]?.trim();
    return { meeting: row.meeting, host: false as const, speaker: named || "Guest" };
  }
  throw new ApiError(user ? 403 : 401, user ? "forbidden" : "unauthenticated", "No access to this meeting");
}

export async function requireMeetingHost(req: Request, meetingId: string) {
  const r = await requireMeetingAccess(req, meetingId);
  if (!r.host) throw new ApiError(403, "forbidden", "Only the host can do this");
  return r.meeting;
}

/** Event stream access: the project owner, or a guest of any meeting in the project. */
export async function requireProjectEvents(req: Request, projectId: string) {
  const user = await currentUser(req);
  const p = await getProject(projectId);
  if (user && p.ownerId === user.id) return;
  const ids = guestMeetings(req);
  if (ids.length) {
    const rows = await db().select({ id: schema.meeting.id }).from(schema.meeting).where(eq(schema.meeting.projectId, projectId));
    if (rows.some((r) => ids.includes(r.id))) return;
  }
  throw new ApiError(user ? 403 : 401, user ? "forbidden" : "unauthenticated", "No access");
}
