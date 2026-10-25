import { NextResponse } from "next/server";
import { ApiError, handle, rateLimit } from "@/server/http";
import { transcribeAudio } from "@/server/llm/tasks";
import { addSegment } from "@/server/pipeline";
import { getMeeting } from "@/server/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Speech to text through the Gemini API. One short audio chunk from one participant's mic. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "transcribe", 60);
  const { id } = await ctx.params;
  const m = await getMeeting(id);
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting already ended");
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) throw new ApiError(400, "no_audio", "Missing audio field");
  if (audio.size < 1500) return NextResponse.json({ text: "" });
  if (audio.size > 4 * 1024 * 1024) throw new ApiError(413, "too_large", "Audio chunk over 4 MB");
  const speaker = ((form.get("speaker") as string | null) ?? "").trim().slice(0, 120);
  if (!speaker) throw new ApiError(400, "no_speaker", "Missing speaker");
  const startSec = Number(form.get("startSec") ?? 0) || 0;
  const mimeType = (audio.type || "audio/webm").split(";")[0]!;
  const text = await transcribeAudio({
    audioBase64: Buffer.from(await audio.arrayBuffer()).toString("base64"),
    mimeType,
    meetingId: id,
  });
  if (text.length < 2) return NextResponse.json({ text: "" });
  await addSegment(id, { speaker, text, startSec });
  return NextResponse.json({ text }, { status: 201 });
});
