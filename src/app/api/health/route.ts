import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { handle } from "@/server/http";
import { llmMode } from "@/server/llm/client";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await db().execute(sql`select 1`);
  return NextResponse.json({ ok: true, llm: llmMode() });
});
