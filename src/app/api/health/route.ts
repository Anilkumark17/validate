import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await db().execute(sql`select 1`);
  return NextResponse.json({ ok: true });
});
