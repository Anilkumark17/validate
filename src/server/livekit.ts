import { DataPacket_Kind, RoomServiceClient } from "livekit-server-sdk";
import { env } from "./env";

export interface TranscriptMessage {
  id: string;
  meetingId: string;
  idx: number;
  speaker: string | null;
  text: string;
  startSec: number | null;
  /** Epoch ms when the speaker's audio chunk ended. Receivers compute end to end latency from it. */
  capturedAt: number | null;
  sentAt: number;
}

const g = globalThis as unknown as { __rooms?: RoomServiceClient };

function rooms(): RoomServiceClient | null {
  const e = env();
  if (!e.LIVEKIT_URL || !e.LIVEKIT_API_KEY || !e.LIVEKIT_API_SECRET) return null;
  return (g.__rooms ??= new RoomServiceClient(e.LIVEKIT_URL.replace(/^wss?:/, "https:"), e.LIVEKIT_API_KEY, e.LIVEKIT_API_SECRET));
}

/**
 * Sends a saved segment to everyone in the meeting room. Called only after the row is committed.
 * A failure here is logged and returned, never thrown: clients recover the line from the database.
 */
export async function broadcastSegment(msg: Omit<TranscriptMessage, "sentAt">): Promise<{ ok: boolean; ms: number }> {
  const started = Date.now();
  const client = rooms();
  if (!client) return { ok: false, ms: 0 };
  try {
    const body = JSON.stringify({ ...msg, sentAt: started } satisfies TranscriptMessage);
    await client.sendData(msg.meetingId, new TextEncoder().encode(body), DataPacket_Kind.RELIABLE, { topic: "transcript" });
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    console.error("[livekit] broadcast failed", e instanceof Error ? e.message : e);
    return { ok: false, ms: Date.now() - started };
  }
}
