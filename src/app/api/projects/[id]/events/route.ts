import { requireProjectEvents } from "@/server/auth";
import { subscribe } from "@/server/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await requireProjectEvents(req, id);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return new Response(null, { status });
  }
  return subscribe(id, req.signal);
}
