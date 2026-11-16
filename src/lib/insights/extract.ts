import { z } from "zod";
import { similarity } from "@/lib/board/constants";

/** Bump when the extract prompt changes. The run key is the meeting id plus this version. */
export const EXTRACT_PROMPT_VERSION = "extract-3";

/** Transcript tokens per chunk. The caller shrinks this further when the provider's per-minute limit is small. */
export const EXTRACT_TOKEN_BUDGET = 2500;

/**
 * Conservative token estimate. Romanised Hindi or Telugu and Indic scripts tokenise worse than English,
 * so this counts one token per three characters, not four.
 */
export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 3));
}

export const INSIGHT_TAGS = ["role", "segment", "stage", "budget", "tools", "frequency", "team_size", "decision_maker"] as const;
export const SEGMENT_FLAGS = ["unclear", "term_untranslated", "ambiguous_assent", "negation_uncertain"] as const;
export const INSIGHT_KINDS = ["pain", "behaviour", "workaround", "tool", "trigger", "buying_criterion", "objection", "surprise"] as const;
export const EVIDENCE_KINDS = ["past_behaviour", "current_pain", "workaround", "opinion", "hypothetical"] as const;

const flag = z.enum(SEGMENT_FLAGS);

export const normaliseOutput = z.object({
  segments: z
    .array(
      z.object({
        id: z.string().uuid(),
        languages: z.array(z.string().trim().min(2).max(12)).max(6),
        code_mixed: z.boolean(),
        text_en: z.string().max(4000),
        confidence: z.number().int().min(0).max(100),
        flags: z.array(flag).max(6),
      }),
    )
    .max(20),
});

const insightItem = z.object({
  id: z.string().trim().min(1).max(40),
  segment_ids: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  t_start: z.number().min(0).nullable().optional(),
  t_end: z.number().min(0).nullable().optional(),
  quote_en: z.string().trim().min(1).max(500),
  summary_en: z.string().trim().min(1).max(400),
  kind: z.enum(INSIGHT_KINDS),
  evidence_type: z.enum(EVIDENCE_KINDS),
  led_by_interviewer: z.boolean(),
  profile_tags: z.array(z.string().trim().min(1).max(80)).max(12),
  importance: z.number().int().min(1).max(5),
  confidence: z.number().int().min(0).max(100),
});

const segmentEn = z.object({
  id: z.string().trim().min(1).max(80),
  languages: z.array(z.string().trim().min(2).max(12)).max(6),
  text_en: z.string().trim().min(1).max(4000),
  confidence: z.number().int().min(0).max(100),
});

export const summaryOutput = z.object({
  headline: z.string().trim().max(400),
  context: z.string().trim().max(800),
  key_takeaways: z.array(z.object({ text: z.string().trim().min(1).max(400), insight_ids: z.array(z.string().trim().min(1).max(40)).max(8) })).max(5),
  surprises: z.array(z.string().trim().max(400)).max(8),
  open_questions: z.array(z.string().trim().max(400)).max(8),
  decisions: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
  action_items: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
  risks: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
  interview_quality: z.object({
    led_count: z.number().int().min(0),
    hypothetical_count: z.number().int().min(0),
    note: z.string().trim().max(500),
  }),
});

const noteList = z.array(z.string().trim().min(1).max(300)).max(8).default([]);

/** Notes from one chunk. They feed the final summary and are not shown on their own. */
export const chunkNotes = z.object({
  key_points: noteList,
  decisions: noteList,
  action_items: noteList,
  risks: noteList,
});

export const blockOutput = z.object({
  segments_en: z.array(segmentEn).max(80),
  insights: z.array(insightItem).max(15),
});

/** One call per chunk: English text, insights with exact quotes, and the chunk's notes. */
export const chunkOutput = z.object({
  segments_en: z.array(segmentEn).max(80).default([]),
  insights: z.array(insightItem).max(8).default([]),
  notes: chunkNotes.default({ key_points: [], decisions: [], action_items: [], risks: [] }),
});

export const reviewOutput = blockOutput.extend({ summary: summaryOutput });
export const summaryOnlyOutput = z.object({ summary: summaryOutput });

export type NormalisedSegment = z.infer<typeof normaliseOutput>["segments"][number];
export type RawInsight = z.infer<typeof insightItem>;
export type SegmentEn = z.infer<typeof segmentEn>;
export type MeetingSummary = z.infer<typeof summaryOutput>;
export type ChunkNotes = z.infer<typeof chunkNotes>;

export interface SpeechSegment {
  id: string;
  idx: number;
  role: "interviewer" | "interviewee";
  speaker: string | null;
  text: string;
  startSec: number | null;
  endSec: number | null;
  textEn?: string | null;
  confidence?: number | null;
  flags?: string[];
}

export interface Window {
  contextBefore: SpeechSegment[];
  targets: SpeechSegment[];
  contextAfter: SpeechSegment[];
}

/** Windows of interviewee segments. Neighbours on either side are context only. */
export function intervieweeWindows(segments: SpeechSegment[], size = 20, pad = 3): Window[] {
  const targets = segments.filter((s) => s.role === "interviewee" && s.text.trim());
  const windows: Window[] = [];
  for (let i = 0; i < targets.length; i += size) {
    const batch = targets.slice(i, i + size);
    const first = segments.findIndex((s) => s.id === batch[0]!.id);
    const last = segments.findIndex((s) => s.id === batch[batch.length - 1]!.id);
    windows.push({
      contextBefore: segments.slice(Math.max(0, first - pad), first),
      targets: batch,
      contextAfter: segments.slice(last + 1, last + 1 + pad),
    });
  }
  return windows;
}

function tokensOf(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** About 1500 tokens of English, overlapping by the last two segments. Ids stay stable. */
export function chunkEnglish(segments: SpeechSegment[], maxTokens = 1500): SpeechSegment[][] {
  const source = segments.filter((s) => s.role === "interviewee" && (s.textEn ?? "").trim());
  const chunks: SpeechSegment[][] = [];
  let cur: SpeechSegment[] = [];
  let tokens = 0;
  for (const s of source) {
    const t = tokensOf(s.textEn ?? "");
    if (cur.length > 0 && tokens + t > maxTokens) {
      chunks.push(cur);
      const overlap = cur.slice(-2);
      cur = [...overlap];
      tokens = overlap.reduce((n, x) => n + tokensOf(x.textEn ?? ""), 0);
    }
    if (!cur.some((x) => x.id === s.id)) {
      cur.push(s);
      tokens += t;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

export interface CheckedInsight extends RawInsight {
  flags: string[];
}

export interface VerifyResult {
  kept: CheckedInsight[];
  dropped: { quote: string; error: string }[];
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** English used for quotes: the stored translation, or the original line when it was already English. */
export function englishText(s: SpeechSegment) {
  const en = (s.textEn ?? "").trim();
  return en || s.text;
}

export function customerTags(customer: { role?: string; segment?: string; stage?: string; tags?: string[] } | null | undefined) {
  if (!customer) return [];
  const tags = [...(customer.tags ?? [])];
  if (customer.role) tags.push(`role:${customer.role}`);
  if (customer.segment) tags.push(`segment:${customer.segment}`);
  if (customer.stage) tags.push(`stage:${customer.stage}`);
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

const segTokens = (s: SpeechSegment) => estimateTokens(s.text) + 12;

/**
 * Splits the transcript into blocks that fit the token budget, cutting only between speaker turns.
 * A single turn longer than the budget is split by segment.
 */
export function transcriptBlocks(segments: SpeechSegment[], budget = EXTRACT_TOKEN_BUDGET): SpeechSegment[][] {
  const turns: SpeechSegment[][] = [];
  for (const s of segments) {
    const last = turns[turns.length - 1];
    if (last && last[0]!.role === s.role) last.push(s);
    else turns.push([s]);
  }
  const units = turns.flatMap((turn) => (turn.reduce((n, s) => n + segTokens(s), 0) <= budget ? [turn] : turn.map((s) => [s])));
  const blocks: SpeechSegment[][] = [];
  let cur: SpeechSegment[] = [];
  let tokens = 0;
  for (const unit of units) {
    const t = unit.reduce((n, s) => n + segTokens(s), 0);
    if (cur.length > 0 && tokens + t > budget) {
      blocks.push(cur);
      cur = [];
      tokens = 0;
    }
    cur.push(...unit);
    tokens += t;
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

/** Drops an insight whose quote is not an exact substring of the cited English. Caps confidence when a line is unclear. */
export function verifyInsights(items: RawInsight[], segments: SpeechSegment[], allowed: readonly string[]): VerifyResult {
  const byId = new Map(segments.map((s) => [s.id, s]));
  const allowedSet = new Set(allowed);
  const kept: CheckedInsight[] = [];
  const dropped: { quote: string; error: string }[] = [];
  for (const item of items) {
    const cited = item.segment_ids.map((id) => byId.get(id));
    if (cited.some((s) => !s)) {
      dropped.push({ quote: item.quote_en, error: "A segment id is not in this meeting" });
      continue;
    }
    const rows = cited.filter((s): s is SpeechSegment => !!s);
    const evidence = rows.filter((s) => s.role === "interviewee");
    const parts = evidence.map(englishText);
    const hay = parts.join("\n");
    const quote = item.quote_en.trim();
    if (evidence.length === 0 || words(quote) > 40 || (!parts.some((p) => p.includes(quote)) && !hay.includes(quote))) {
      dropped.push({ quote, error: "quote_en is not an exact substring of the cited English, or it is over 40 words" });
      continue;
    }
    if (item.profile_tags.some((t) => !allowedSet.has(t))) {
      dropped.push({ quote, error: "A profile tag is not on the customer record" });
      continue;
    }
    const flags = new Set<string>();
    let confidence = item.confidence;
    for (const s of evidence) {
      if (englishText(s).includes("[unclear]") || (s.confidence != null && s.confidence < 50)) {
        confidence = Math.min(confidence, 60);
        flags.add("unclear");
      }
    }
    kept.push({ ...item, quote_en: quote, confidence, flags: [...flags] });
  }
  return { kept, dropped };
}

/** Rewrites takeaway ids onto the insights that were kept, and recounts led and hypothetical answers. */
export function bindSummary(summary: MeetingSummary, insights: CheckedInsight[]): MeetingSummary {
  const ids = new Set(insights.map((i) => i.id));
  return {
    ...summary,
    key_takeaways: summary.key_takeaways
      .map((t) => ({ text: t.text, insight_ids: t.insight_ids.filter((id) => ids.has(id)) }))
      .filter((t) => t.insight_ids.length > 0)
      .slice(0, 5),
    interview_quality: {
      ...summary.interview_quality,
      led_count: insights.filter((i) => i.led_by_interviewer).length,
      hypothetical_count: insights.filter((i) => i.evidence_type === "hypothetical").length,
    },
  };
}

export function failureRate(kept: number, dropped: number) {
  const total = kept + dropped;
  return total === 0 ? 0 : dropped / total;
}

/** Shared segment ids, or near-duplicate quotes, collapse to the higher importance. Top 15 stay. */
export function mergeInsights(items: CheckedInsight[], limit = 15): CheckedInsight[] {
  const ranked = [...items].sort((a, b) => b.importance - a.importance || b.confidence - a.confidence);
  const kept: CheckedInsight[] = [];
  for (const item of ranked) {
    const dup = kept.some((k) => k.segment_ids.some((id) => item.segment_ids.includes(id)) || similarity(k.quote_en, item.quote_en) >= 0.8);
    if (!dup) kept.push(item);
  }
  return kept.slice(0, limit);
}
