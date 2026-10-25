import { z } from "zod";
import { env } from "../env";
import { generateJson } from "./client";
import { IDEA_MAP_SYSTEM, ideaMapPrompt } from "./idea-map-prompt";
import {
  ANALYZE_SYSTEM,
  FACTS_SYSTEM,
  VOICE_SYSTEM,
  factsPrompt,
  voicePrompt,
  DRAFT_SYSTEM,
  IMAGE_SYSTEM,
  PERSONA_SYSTEM,
  QUESTIONS_SYSTEM,
  TRANSCRIBE_SYSTEM,
  analyzePrompt,
  draftPrompt,
  imagePrompt,
  personaPrompt,
  questionsPrompt,
  type PromptAssumption,
} from "./prompts";

const strength = z.coerce.number().int().min(1).max(3).catch(2);
const linkZ = z.object({
  assumptionId: z.string(),
  stance: z.enum(["supports", "contradicts", "neutral"]),
  strength,
  rationale: z.string().default(""),
});
export type LinkOut = z.infer<typeof linkZ>;

const analyzeZ = z.array(
  z.object({
    segmentIdx: z.coerce.number().int(),
    claim: z.string().min(1),
    quote: z.string().min(1),
    links: z.array(linkZ).default([]),
  }),
);
export type AnalyzedItem = z.infer<typeof analyzeZ>[number];

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export async function analyzeSegments(args: {
  meetingId: string;
  assumptions: PromptAssumption[];
  priorContext: { idx: number; speaker: string | null; text: string }[];
  segments: { idx: number; speaker: string | null; text: string }[];
}): Promise<AnalyzedItem[]> {
  const raw = await generateJson(
    {
      model: env().GEMMA_MODEL_JUDGE, fallbackModel: env().GEMMA_MODEL_FAST,
      system: ANALYZE_SYSTEM,
      parts: [{ text: analyzePrompt(args) }],
      thinking: true,
      meetingId: args.meetingId,
    },
    analyzeZ,
  );
  const ids = new Set(args.assumptions.map((a) => a.id));
  const byIdx = new Map(args.segments.map((s) => [s.idx, s]));
  const out: AnalyzedItem[] = [];
  for (const item of raw) {
    const seg = byIdx.get(item.segmentIdx);
    if (!seg || !norm(seg.text).includes(norm(item.quote))) continue;
    const links = item.links.filter((l) => ids.has(l.assumptionId));
    if (links.length === 0) continue;
    out.push({ ...item, links });
  }
  return out;
}

const imageZ = z.object({
  summary: z.string().default(""),
  evidence: z.array(z.object({ claim: z.string().min(1), links: z.array(linkZ).default([]) })).default([]),
});
export type ImageResult = z.infer<typeof imageZ>;

export async function describeImage(args: {
  meetingId?: string | null;
  imageBase64: string;
  mimeType: string;
  assumptions: PromptAssumption[];
}): Promise<ImageResult> {
  const out = await generateJson(
    {
      model: env().GEMMA_MODEL_FAST,
      system: IMAGE_SYSTEM,
      parts: [{ inlineData: { data: args.imageBase64, mimeType: args.mimeType } }, { text: imagePrompt(args.assumptions) }],
      meetingId: args.meetingId,
    },
    imageZ,
  );
  const ids = new Set(args.assumptions.map((a) => a.id));
  return {
    summary: out.summary,
    evidence: out.evidence
      .map((e) => ({ ...e, links: e.links.filter((l) => ids.has(l.assumptionId)) }))
      .filter((e) => e.links.length > 0),
  };
}

const draftZ = z.object({
  assumptions: z
    .array(
      z.object({
        statement: z.string().min(3),
        type: z.enum(["desirability", "feasibility", "viability"]),
        risk: z.coerce.number().int().min(1).max(5).catch(3),
      }),
    )
    .min(1),
});

export async function draftAssumptions(args: { productContext: string }) {
  const out = await generateJson(
    { model: env().GEMMA_MODEL_FAST, system: DRAFT_SYSTEM, parts: [{ text: draftPrompt(args.productContext) }] },
    draftZ,
  );
  return out.assumptions.slice(0, 10);
}

const questionsZ = z.object({
  items: z.array(z.object({ assumptionId: z.string(), questions: z.array(z.string()).min(1) })),
});

export async function suggestQuestions(args: { assumptions: PromptAssumption[] }) {
  if (args.assumptions.length === 0) return [];
  const out = await generateJson(
    { model: env().GEMMA_MODEL_FAST, system: QUESTIONS_SYSTEM, parts: [{ text: questionsPrompt(args.assumptions) }] },
    questionsZ,
  );
  const ids = new Set(args.assumptions.map((a) => a.id));
  return out.items.filter((i) => ids.has(i.assumptionId)).map((i) => ({ ...i, questions: i.questions.slice(0, 2) }));
}

const personaZ = z.object({
  name: z.string(),
  archetype: z.string(),
  summary: z.string(),
  demographics: z.string().default("Unknown"),
  goals: z.array(z.string()).default([]),
  pains: z.array(z.string()).default([]),
  behaviors: z.array(z.string()).default([]),
  willingnessToPay: z.string().default("Unknown"),
  triggers: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  segments: z.array(z.string()).default([]),
  quotes: z.array(z.object({ quote: z.string(), speaker: z.string().default("Unknown") })).default([]),
  confidence: z.coerce.number().min(0).max(1).catch(0.5),
});
export type Persona = z.infer<typeof personaZ>;

export async function buildPersona(args: {
  project: { name: string; targetUser: string | null };
  items: { speaker: string | null; claim: string; quote: string | null; stance: string; assumption: string }[];
}): Promise<Persona> {
  const out = await generateJson(
    { model: env().GEMMA_MODEL_JUDGE, fallbackModel: env().GEMMA_MODEL_FAST, system: PERSONA_SYSTEM, parts: [{ text: personaPrompt(args) }], thinking: true },
    personaZ,
  );
  const known = args.items.map((i) => i.quote).filter((q): q is string => !!q).map(norm);
  return { ...out, quotes: out.quotes.filter((q) => known.some((k) => k.includes(norm(q.quote)))) };
}

const testZ = z.object({
  method: z.string(),
  who: z.string().default(""),
  action: z.string().default(""),
  passSignal: z.string().default(""),
  failSignal: z.string().default(""),
  effort: z.string().default("days"),
});
const ideaMapZ = z.object({
  ideaCard: z.object({ customer: z.string().default(""), problem: z.string().default(""), solution: z.string().default("") }).passthrough(),
  clarifyingQuestions: z.array(z.string()).default([]),
  assumptions: z.array(
    z.object({
      id: z.string(),
      statement: z.string().min(3),
      type: z.enum(["desirability", "feasibility", "viability"]),
      category: z.string().default(""),
      origin: z.enum(["stated", "implicit"]).catch("implicit"),
      importance: z.coerce.number().int().min(1).max(5).catch(3),
      evidence: z.enum(["none", "anecdotal", "secondary", "behavioral"]).catch("none"),
      evidenceNote: z.string().optional(),
      risk: z.coerce.number().int().min(1).max(5).catch(3),
      dependsOn: z.array(z.string()).default([]),
      falsifiedIf: z.string().default(""),
      leapOfFaith: z.boolean().catch(false),
      test: testZ.optional().catch(undefined),
    }),
  ),
  testSequence: z.array(z.string()).default([]),
  blindSpots: z.array(z.string()).default([]),
  claimsToVerify: z.array(z.string()).default([]),
});
export type IdeaMap = z.infer<typeof ideaMapZ>;

export async function mapIdea(args: {
  idea: string;
  customer?: string;
  stage?: string;
  known?: string;
  constraints?: string;
  meetingId?: string | null;
}): Promise<IdeaMap> {
  return generateJson(
    {
      model: env().GEMMA_MODEL_JUDGE, fallbackModel: env().GEMMA_MODEL_FAST,
      system: IDEA_MAP_SYSTEM,
      parts: [{ text: ideaMapPrompt(args) }],
      timeoutMs: 150_000,
      meetingId: args.meetingId,
    },
    ideaMapZ,
  );
}

const factsZ = z.array(
  z.object({
    segmentIdx: z.coerce.number().int(),
    kind: z.enum(["behavior", "pain", "goal", "constraint", "language", "tone"]),
    statement: z.string().min(1),
    quote: z.string().default(""),
    phrases: z.array(z.string()).default([]),
    outboundTest: z.string().default(""),
  }),
);
export type FactOut = z.infer<typeof factsZ>[number];

export async function extractFacts(args: {
  meetingId: string;
  segments: { idx: number; speaker: string | null; text: string }[];
}): Promise<FactOut[]> {
  const raw = await generateJson(
    { model: env().GEMMA_MODEL_FAST, system: FACTS_SYSTEM, parts: [{ text: factsPrompt(args.segments) }], timeoutMs: 60_000, meetingId: args.meetingId },
    factsZ,
  );
  const byIdx = new Map(args.segments.map((s) => [s.idx, s]));
  return raw
    .filter((f) => {
      const seg = byIdx.get(f.segmentIdx);
      return !!seg && (!f.quote || norm(seg.text).includes(norm(f.quote)));
    })
    .map((f) => {
      const seg = byIdx.get(f.segmentIdx)!;
      return { ...f, phrases: f.phrases.filter((p) => norm(seg.text).includes(norm(p))) };
    });
}

const voiceZ = z.object({
  language: z.string().default("English"),
  tone: z.object({
    register: z.string().default(""),
    sentenceStyle: z.string().default(""),
    temperature: z.string().default(""),
    humor: z.string().default(""),
    distrusts: z.array(z.string()).default([]),
  }),
  phrasebook: z.array(z.object({ phrase: z.string(), meaning: z.string().default("") })).default([]),
  doSay: z.array(z.string()).default([]),
  dontSay: z.array(z.string()).default([]),
  outboundDrafts: z
    .array(
      z.object({
        channel: z.string().default("email"),
        subject: z.string().default(""),
        message: z.string(),
        factId: z.string().default(""),
        hypothesis: z.string().default(""),
      }),
    )
    .default([]),
});
export type Voice = z.infer<typeof voiceZ>;

export async function buildVoice(args: {
  project: { name: string; targetUser: string | null };
  facts: { id: string; kind: string; statement: string; quote: string | null; phrases: string[]; speaker: string | null }[];
}): Promise<Voice> {
  const out = await generateJson(
    { model: env().GEMMA_MODEL_JUDGE, fallbackModel: env().GEMMA_MODEL_FAST, system: VOICE_SYSTEM, parts: [{ text: voicePrompt(args) }], timeoutMs: 120_000 },
    voiceZ,
  );
  const corpus = norm(args.facts.map((f) => `${f.quote ?? ""} ${f.phrases.join(" ")}`).join(" "));
  const ids = new Set(args.facts.map((f) => f.id));
  return {
    ...out,
    phrasebook: out.phrasebook.filter((p) => corpus.includes(norm(p.phrase))),
    outboundDrafts: out.outboundDrafts.map((d) => (ids.has(d.factId) ? d : { ...d, factId: "" })),
  };
}

const transcribeZ =z.object({ text: z.string().default("") });

export async function transcribeAudio(args: { audioBase64: string; mimeType: string; meetingId?: string | null }): Promise<string> {
  const out = await generateJson(
    {
      model: env().STT_MODEL,
      system: TRANSCRIBE_SYSTEM,
      parts: [{ inlineData: { data: args.audioBase64, mimeType: args.mimeType } }, { text: "Transcribe this audio." }],
      minimalThinking: true,
      meetingId: args.meetingId,
    },
    transcribeZ,
  );
  return out.text.trim();
}
