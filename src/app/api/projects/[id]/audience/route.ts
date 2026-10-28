import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, parseBody } from "@/server/http";
import { audienceInput } from "@/lib/board/schemas";

export const dynamic = "force-dynamic";

/** The answer to "Whom are you building this product for?". Skipping keeps the audience provisional. */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireProject(req, id);
  const v = await parseBody(req, audienceInput);
  if (v.state === "confirmed" && !v.value) throw new ApiError(400, "audience_required", "Enter or choose an audience, or skip the question");
  const [row] = await db()
    .update(schema.project)
    .set({ audienceState: v.state, ...(v.state === "confirmed" ? { targetUser: v.value } : {}) })
    .where(eq(schema.project.id, id))
    .returning({ audienceState: schema.project.audienceState, targetUser: schema.project.targetUser });
  return NextResponse.json(row);
});
