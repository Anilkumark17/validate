import { NextResponse } from "next/server";
import { requireMeetingAccess } from "@/server/auth";
import { ApiError, handle, rateLimit } from "@/server/http";
import { broadcastSegment } from "@/server/livekit";
import { savedSegments } from "@/server/segment-dedupe";
import { addSegment } from "@/server/segments";
import { SttError, transcribeSarvam } from "@/server/stt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 16 kHz mono 16 bit is 32 KB/s, so about 65 s
const MAX_AUDIO_MS = 30_000;

type Saved = Awaited<ReturnType<typeof addSegment>>;

/** wav header says mono 16 bit PCM and the data length matches the file */
function wavDurationMs(buf: ArrayBuffer): number | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || v.getUint16(20, true) !== 1 || v.getUint16(22, true) !== 1) return null;
  const rate = v.getUint32(24, true);
  if (v.getUint16(34, true) !== 16 || rate < 8000 || rate > 48_000) return null;
  return ((buf.byteLength - 44) / 2 / rate) * 1000;
}

/**
 * Sarvam speech to text for one audio chunk. Order: access check, validate, transcribe, persist,
 * then broadcast over LiveKit. When Sarvam fails the response carries code stt_unavailable so the
 * client can switch to the browser's own speech recognition.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "transcribe", 90);
  const t0 = Date.now();
  const { id } = await ctx.params;
  const { meeting: m } = await requireMeetingAccess(req, id);
  if (m.state === "ended") throw new ApiError(409, "ended", "Meeting already ended");

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) throw new ApiError(400, "no_audio", "Missing audio field");
  if (audio.size > MAX_BYTES) throw new ApiError(413, "too_large", "Audio chunk too large");
  const speaker = ((form.get("speaker") as string | null) ?? "").trim().slice(0, 120);
  if (!speaker) throw new ApiError(400, "no_speaker", "Missing speaker");
  const clientId = String(form.get("clientId") ?? "");
  if (!/^[\w-]{8,64}$/.test(clientId)) throw new ApiError(400, "no_client_id", "Missing clientId");
  const startSec = Math.max(0, Number(form.get("startSec") ?? 0) || 0);
  const capturedAt = Number(form.get("capturedAt") ?? 0) || null;

  const bytes = await audio.arrayBuffer();
  const audioMs = wavDurationMs(bytes);
  if (audioMs === null) throw new ApiError(400, "bad_audio", "Expected mono 16 bit wav");
  if (audioMs > MAX_AUDIO_MS) throw new ApiError(413, "too_long", "Audio chunk longer than 30 seconds");
  if (audioMs < 300) return NextResponse.json({ segment: null });

  // A retried POST with the same clientId gets the first result: no second Sarvam call, no second row.
  const key = `${id}:${clientId}`;
  let work = savedSegments.get(key) as Promise<Saved | null> | undefined;
  const duplicate = !!work;
  let sarvamMs = 0;
  if (!work) {
    work = (async () => {
      const r = await transcribeSarvam(new Blob([bytes], { type: "audio/wav" }));
      sarvamMs = r.ms;
      if (r.text.length < 2) return null;
      const row = await addSegment(id, { speaker, text: r.text, startSec });
      void broadcastSegment({
        id: row.id,
        meetingId: id,
        idx: row.idx,
        speaker: row.speaker,
        text: row.text,
        startSec: row.startSec,
        capturedAt,
      });
      return row;
    })();
    savedSegments.set(key, work);
    work.catch(() => savedSegments.delete(key));
  }

  try {
    const segment = await work;
    if (!duplicate) console.log(JSON.stringify({ evt: "stt", provider: "sarvam", meetingId: id, clientId, audioMs: Math.round(audioMs), sarvamMs, totalMs: Date.now() - t0 }));
    return NextResponse.json({ segment, duplicate }, { status: segment && !duplicate ? 201 : 200 });
  } catch (e) {
    if (e instanceof SttError) {
      return NextResponse.json(
        { error: { code: "stt_unavailable", message: e.message, fatal: e.fatal } },
        { status: e.status === 429 ? 429 : 503 },
      );
    }
    throw e;
  }
});
