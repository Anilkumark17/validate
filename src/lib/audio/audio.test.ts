import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/api";
import { insertSegment } from "@/lib/transcript";
import { isTransient, retryDelayMs } from "@/server/stt";
import { TtlMap } from "@/server/segment-dedupe";
import { DEFAULT_ENDPOINTER, Endpointer, type PcmChunk } from "./endpointer";
import { percentile } from "./metrics";
import { UploadQueue, type QueuedChunk } from "./upload-queue";
import { encodeWav } from "./wav";

const RATE = 16_000;
const block = (ms: number, amp: number) => new Float32Array((RATE * ms) / 1000).fill(amp);
const opts = { ...DEFAULT_ENDPOINTER, sampleRate: RATE };

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16 bit header with the right sizes", () => {
    const buf = encodeWav(new Float32Array(1600), RATE);
    const v = new DataView(buf);
    expect(buf.byteLength).toBe(44 + 3200);
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe("RIFF");
    expect(v.getUint32(24, true)).toBe(RATE);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(3200);
  });
});

describe("Endpointer", () => {
  it("emits nothing for pure silence", () => {
    const ep = new Endpointer(opts);
    for (let i = 0; i < 100; i++) expect(ep.push(block(100, 0))).toBeNull();
    expect(ep.flush()).toBeNull();
  });

  it("cuts on a pause once min length is reached, and loses no audio between chunks", () => {
    const ep = new Endpointer(opts);
    const out: PcmChunk[] = [];
    const feed = (ms: number, amp: number) => {
      for (let t = 0; t < ms; t += 100) {
        const c = ep.push(block(100, amp));
        if (c) out.push(c);
      }
    };
    feed(3000, 0.2);
    expect(out.length).toBe(0); // no pause yet
    feed(600, 0); // pause >= silenceMs
    expect(out.length).toBe(1);
    expect(out[0]!.durationMs).toBeGreaterThanOrEqual(3000);
    feed(2500, 0.2);
    const tail = ep.flush();
    if (tail) out.push(tail);
    expect(out.length).toBe(2);
    expect(out[1]!.startMs).toBeCloseTo(out[0]!.startMs + out[0]!.durationMs, 0);
  });

  it("force cuts at maxMs during continuous speech", () => {
    const ep = new Endpointer(opts);
    let cut: PcmChunk | null = null;
    for (let t = 0; t < 8000 && !cut; t += 100) cut = ep.push(block(100, 0.2));
    expect(cut).not.toBeNull();
    expect(cut!.durationMs).toBeCloseTo(8000, 0);
  });
});

const chunk = (id: string, sec: number): QueuedChunk => ({
  chunkId: id,
  seq: 0,
  samples: new Float32Array(RATE * sec),
  startSec: 0,
  capturedAt: 0,
  enqueuedAt: 0,
});
const base = { maxPending: 4, maxAttempts: 3, maxMergedSec: 28, sampleRate: RATE, sleep: async () => {} };

describe("UploadQueue", () => {
  it("sends in order, one at a time", async () => {
    const order: string[] = [];
    let inflight = 0;
    let maxInflight = 0;
    const q = new UploadQueue({
      ...base,
      send: async (c) => {
        inflight++;
        maxInflight = Math.max(maxInflight, inflight);
        await new Promise((r) => setTimeout(r, 5));
        order.push(c.chunkId);
        inflight--;
        return { ok: true };
      },
    });
    ["a", "b", "c"].forEach((id) => q.push(chunk(id, 2)));
    await new Promise((r) => setTimeout(r, 80));
    expect(order).toEqual(["a", "b", "c"]);
    expect(maxInflight).toBe(1);
  });

  it("retries transient failures with the same id and reports a final failure once", async () => {
    const seen: string[] = [];
    const failed: string[] = [];
    const q = new UploadQueue({
      ...base,
      onFailed: (c) => failed.push(c.chunkId),
      send: async (c) => {
        seen.push(c.chunkId);
        return { ok: false, retryable: true };
      },
    });
    q.push(chunk("x", 2));
    await new Promise((r) => setTimeout(r, 30));
    expect(seen).toEqual(["x", "x", "x"]);
    expect(failed).toEqual(["x"]);

    const q2 = new UploadQueue({ ...base, send: async () => ({ ok: false, retryable: false }) });
    q2.push(chunk("y", 2));
    await new Promise((r) => setTimeout(r, 20));
    expect(q2.stats.failed).toBe(1);
    expect(q2.stats.retries).toBe(0);
  });

  it("merges waiting chunks instead of dropping audio when backed up", async () => {
    const sent: QueuedChunk[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const q = new UploadQueue({
      ...base,
      maxPending: 2,
      maxAttempts: 1,
      send: async (c) => {
        await gate;
        sent.push(c);
        return { ok: true };
      },
    });
    for (const id of ["a", "b", "c", "d", "e"]) q.push(chunk(id, 2));
    release();
    await new Promise((r) => setTimeout(r, 30));
    expect(sent.reduce((s, c) => s + c.samples.length / RATE, 0)).toBe(10);
    expect(q.stats.dropped).toBe(0);
    expect(q.stats.coalesced).toBeGreaterThan(0);
  });
});

describe("Sarvam retry rules", () => {
  it("retries 429 and 5xx only", () => {
    expect([429, 500, 503].every(isTransient)).toBe(true);
    expect([400, 401, 403, 413, 422].some(isTransient)).toBe(false);
  });
  it("honors Retry-After, capped", () => {
    expect(retryDelayMs(0, "3")).toBe(3000);
    expect(retryDelayMs(0, "60")).toBe(5000);
    expect(retryDelayMs(1, null)).toBeGreaterThanOrEqual(600);
  });
});

describe("insertSegment", () => {
  const seg = (id: string, idx: number, startSec: number | null): Segment => ({ id, meetingId: "m", idx, speaker: "s", text: id, startSec });
  it("orders by startSec then idx and ignores duplicates", () => {
    let l: Segment[] = [];
    l = insertSegment(l, seg("b", 1, 10));
    l = insertSegment(l, seg("a", 0, 2));
    l = insertSegment(l, seg("c", 2, 10));
    l = insertSegment(l, seg("n", 3, null));
    const dup = insertSegment(l, seg("a", 0, 2));
    expect(l.map((s) => s.id)).toEqual(["a", "b", "c", "n"]);
    expect(dup).toBe(l);
  });
});

describe("percentile", () => {
  it("computes p50 and p95", () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 95)).toBe(95);
    expect(percentile([], 95)).toBe(0);
  });
});

describe("TtlMap", () => {
  it("expires entries and stays bounded", () => {
    let now = 0;
    const m = new TtlMap<string>(1000, 3, () => now);
    m.set("a", "1");
    expect(m.get("a")).toBe("1");
    now = 1001;
    expect(m.get("a")).toBeUndefined();
    for (let i = 0; i < 10; i++) m.set(String(i), String(i));
    expect(m.get("0")).toBeUndefined();
    expect(m.get("9")).toBe("9");
  });
});
