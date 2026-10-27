import { NextResponse } from "next/server";
import { z } from "zod";
import { setSession, hashPassword } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody, rateLimit } from "@/server/http";

export const dynamic = "force-dynamic";

const input = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export const POST = handle(async (req: Request) => {
  rateLimit(req, "signup", 10);
  const v = await parseBody(req, input);
  const rows = await db()
    .insert(schema.appUser)
    .values({ name: v.name, email: v.email, passwordHash: hashPassword(v.password) })
    .onConflictDoNothing()
    .returning({ id: schema.appUser.id, email: schema.appUser.email, name: schema.appUser.name });
  const u = rows[0];
  if (!u) throw new ApiError(409, "email_taken", "An account with this email already exists");
  const res = NextResponse.json(u, { status: 201 });
  setSession(res, u.id);
  return res;
});
