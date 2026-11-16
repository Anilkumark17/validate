import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";
import { isExempt } from "@/server/limits";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = await requireUser(req);
  return NextResponse.json({ ...u, exempt: isExempt(u.email) });
});
