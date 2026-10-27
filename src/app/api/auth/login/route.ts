import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setSession, verifyPassword } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";

const input = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const POST = handle(async (req: Request) => {
  rateLimit(req, "login", 10);
  const v = await parseBody(req, input);
  const [u] = await db().select().from(schema.appUser).where(eq(schema.appUser.email, v.email));
  if (!u || !verifyPassword(v.password, u.passwordHash)) throw new ApiError(401, "bad_credentials", "Wrong email or password");
  const res = NextResponse.json({ id: u.id, email: u.email, name: u.name });
  setSession(res, u.id);
  return res;
});
