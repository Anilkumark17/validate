import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => NextResponse.json(await requireUser(req)));
