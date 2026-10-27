import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/api";
import { insertSegment } from "@/lib/transcript";
import { TtlMap } from "@/server/segment-dedupe";
import { percentile } from "./metrics";

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
