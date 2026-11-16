import { describe, expect, it } from "vitest";
import { bindSummary, chunkEnglish, customerTags, failureRate, intervieweeWindows, mergeInsights, transcriptBlocks, verifyInsights, type MeetingSummary, type SpeechSegment } from "./extract";

const seg = (n: number, role: SpeechSegment["role"], text: string, extra: Partial<SpeechSegment> = {}): SpeechSegment => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  idx: n,
  role,
  speaker: role === "interviewer" ? "Host" : "Guest",
  text,
  startSec: n,
  endSec: n + 1,
  textEn: text,
  confidence: 90,
  flags: [],
  ...extra,
});

describe("extract windows and chunks", () => {
  const segments = Array.from({ length: 30 }, (_, i) => seg(i + 1, i % 5 === 0 ? "interviewer" : "interviewee", `line ${i + 1}`));
  it("windows interviewee lines and keeps side context out of the targets", () => {
    const windows = intervieweeWindows(segments, 20, 3);
    expect(windows.length).toBe(2);
    expect(windows[0]!.targets).toHaveLength(20);
    expect(windows[0]!.targets.every((s) => s.role === "interviewee")).toBe(true);
    expect(windows[1]!.contextBefore.length).toBeGreaterThan(0);
    expect(windows[1]!.targets.every((s) => !windows[0]!.targets.some((t) => t.id === s.id))).toBe(true);
  });
  it("overlaps chunks by two segments and keeps ids", () => {
    const english = Array.from({ length: 4 }, (_, i) => seg(i + 1, "interviewee", "x".repeat(2400)));
    const chunks = chunkEnglish(english, 1500);
    expect(chunks.length).toBeGreaterThan(1);
    const overlap = chunks[0]!.slice(-2).map((s) => s.id);
    expect(chunks[1]!.slice(0, 2).map((s) => s.id)).toEqual(overlap);
  });
});

describe("verify and merge", () => {
  const cited = seg(1, "interviewee", "I cancelled two apps last month.");
  const base = {
    id: "i1",
    segment_ids: [cited.id],
    t_start: 1,
    t_end: 2,
    quote_en: "I cancelled two apps last month.",
    summary_en: "They cancelled two apps last month.",
    kind: "behaviour" as const,
    evidence_type: "past_behaviour" as const,
    led_by_interviewer: false,
    profile_tags: [] as string[],
    importance: 4,
    confidence: 80,
  };
  it("keeps an exact quote and drops a paraphrase", () => {
    const ok = verifyInsights([base], [cited], ["role:founder"]);
    expect(ok.kept).toHaveLength(1);
    const bad = verifyInsights([{ ...base, quote_en: "They cancelled two apps." }], [cited], ["role:founder"]);
    expect(bad.dropped).toHaveLength(1);
  });
  it("uses the original line when it is already English and caps an unclear line", () => {
    const original = { ...cited, textEn: null };
    const ok = verifyInsights([base], [original], []);
    expect(ok.kept).toHaveLength(1);
    const unclear = { ...cited, textEn: "I cancelled two apps last month. [unclear]", confidence: 40 };
    const capped = verifyInsights([base], [unclear], []);
    expect(capped.kept[0]!.confidence).toBe(60);
    expect(capped.kept[0]!.flags).toContain("unclear");
  });
  it("drops a tag that is not on the customer record", () => {
    const r = verifyInsights([{ ...base, profile_tags: ["role:founder"] }], [cited], customerTags({ role: "pm" }));
    expect(r.dropped[0]!.error).toMatch(/customer/);
  });
  it("drops an interviewer line and merges to the top importance", () => {
    const host = seg(3, "interviewer", "I cancelled two apps last month.");
    const led = verifyInsights([{ ...base, segment_ids: [host.id] }], [host], []);
    expect(led.dropped).toHaveLength(1);
    const a = { ...base, flags: [], importance: 5 };
    const b = { ...base, flags: [], importance: 2, summary_en: "Another line." };
    const other = { ...base, id: "i2", segment_ids: [seg(2, "interviewee", "I paid five lakh.").id], quote_en: "I paid five lakh.", summary_en: "They paid five lakh.", flags: [], importance: 3 };
    const merged = mergeInsights([b, a, other], 15);
    expect(merged.map((m) => m.importance)).toEqual([5, 3]);
    expect(failureRate(8, 3)).toBeGreaterThan(0.2);
  });
  it("splits a long transcript into blocks and keeps takeaways that still have an insight", () => {
    const long = Array.from({ length: 3 }, (_, i) => seg(i + 1, "interviewee", "word ".repeat(4000)));
    expect(transcriptBlocks(long, 3000).length).toBeGreaterThan(1);
    const summary: MeetingSummary = {
      headline: "Notes are scattered.",
      context: "A founder described last week's calls.",
      key_takeaways: [
        { text: "Notes live in Notion.", insight_ids: ["i1"] },
        { text: "This one was dropped.", insight_ids: ["i9"] },
      ],
      surprises: [],
      open_questions: [],
      decisions: [],
      action_items: [],
      risks: [],
      interview_quality: { led_count: 4, hypothetical_count: 4, note: "Most of the call was a specific story." },
    };
    const bound = bindSummary(summary, [{ ...base, flags: [] }]);
    expect(bound.key_takeaways).toHaveLength(1);
    expect(bound.interview_quality.led_count).toBe(0);
  });
});
