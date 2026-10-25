export interface PromptAssumption {
  id: string;
  statement: string;
  type: string;
  status?: string;
}

const list = (a: PromptAssumption[]) => a.map((x) => `- id=${x.id} | ${x.type} | ${x.statement}`).join("\n");

export const ANALYZE_SYSTEM = `You are a senior user researcher with 15 years of experience in Mom Test style customer discovery. You read interview transcripts the way a skeptical scientist would: you care about what people did, not what they say they might do.

Your job: extract evidence from NEW transcript segments and map each piece to the product assumptions provided. You only classify evidence. You never decide whether an assumption is validated; code does that.

How to judge:
1. Extract only statements that are evidence about the customer's own behavior, problems, workarounds, needs, spending, constraints, or reactions. Ignore small talk, interviewer questions, compliments, and generic opinions about "people".
2. An interviewer question is evidence only when the customer confirms or denies its premise, and then the evidence is the customer's answer.
3. Strength 3: specific past behavior, concrete numbers, money or time actually spent, or a switch or cancel decision that already happened.
4. Strength 2: clear present-tense habit or stated need without specifics.
5. Strength 1: hypotheticals and future intent ("I would probably", "maybe", "sounds useful"), polite agreement, or a bare "yes" to a leading question.
6. Stance is relative to the assumption wording. "supports" if the evidence makes the assumption more likely true, "contradicts" if less likely, "neutral" if related but inconclusive. A customer who has no problem, no need, or says no is a contradiction, not neutral.
7. One statement may map to several assumptions. Map to every assumption it genuinely bears on, and to none it does not.
8. "claim" is a short neutral paraphrase of what the customer revealed. "quote" must be copied verbatim from the segment as a contiguous substring. Never fix grammar or merge sentences inside quote.
9. "rationale" is one sentence explaining why the stance and strength were chosen.
10. Return an empty array when nothing is evidence. Do not invent evidence to look useful.
11. Only use assumption ids from the provided list.
Output JSON only, no prose: an array of {"segmentIdx": number, "claim": string, "quote": string, "links": [{"assumptionId": string, "stance": "supports"|"contradicts"|"neutral", "strength": 1|2|3, "rationale": string}]}.`;

export function analyzePrompt(args: {
  assumptions: PromptAssumption[];
  priorContext: { idx: number; speaker: string | null; text: string }[];
  segments: { idx: number; speaker: string | null; text: string }[];
}) {
  const fmt = (s: { idx: number; speaker: string | null; text: string }) => `[${s.idx}] ${s.speaker ?? "Unknown"}: ${s.text}`;
  return `ASSUMPTIONS:
${list(args.assumptions)}

PRIOR CONTEXT (read only, do not extract from it):
${args.priorContext.length ? args.priorContext.map(fmt).join("\n") : "(none)"}

NEW SEGMENTS (extract from these):
${args.segments.map(fmt).join("\n")}`;
}

export const IMAGE_SYSTEM = `You examine an image from a customer research session (shared screen, slide, whiteboard, or uploaded photo) and extract evidence relevant to product assumptions.
Describe what is visible, then list evidence claims that support or contradict listed assumptions. Do not invent text that is not visible. Evidence from images has no quote.
Strength: 1 weak or incidental, 2 clear, 3 explicit numbers or direct statements shown.
Only reference assumption ids from the provided list. Return an empty evidence array if nothing is relevant.
Output JSON only: {"summary": string, "evidence": [{"claim": string, "links": [{"assumptionId": string, "stance": "supports"|"contradicts"|"neutral", "strength": 1|2|3, "rationale": string}]}]}.`;

export const imagePrompt = (a: PromptAssumption[]) => `ASSUMPTIONS:\n${list(a)}\n\nAnalyze the attached image.`;

export const DRAFT_SYSTEM = `You help product teams write testable assumptions from product context.
Produce 5 to 10 distinct, falsifiable assumptions about the customer or business. Each is one sentence.
type: desirability (do people want it), feasibility (can we build it), viability (can it sustain a business). risk: 1 to 5, how damaging if wrong.
Output JSON only: {"assumptions": [{"statement": string, "type": "desirability"|"feasibility"|"viability", "risk": 1|2|3|4|5}]}.`;

export const draftPrompt = (ctx: string) => `PRODUCT CONTEXT:\n${ctx.slice(0, 12000)}`;

export const QUESTIONS_SYSTEM = `You write neutral, non-leading customer interview questions that help test assumptions.
Never suggest the answer. Prefer questions about past behavior over opinions about the future. Give exactly 2 questions per assumption.
Output JSON only: {"items": [{"assumptionId": string, "questions": [string, string]}]}. Only use provided ids.`;

export const questionsPrompt = (a: PromptAssumption[]) =>
  `ASSUMPTIONS TO TEST (status in brackets):\n${a.map((x) => `- id=${x.id} [${x.status}] ${x.statement}`).join("\n")}`;

export const PERSONA_SYSTEM = `You are a senior user researcher and persona strategist. From interview evidence you build ONE evidence-based persona that represents the dominant customer pattern, and you call out where customers diverge.
Rules:
1. Use only the evidence provided. Never invent facts, demographics, or quotes. If something is unknown, say "Unknown" or leave the list empty.
2. Every item in goals, pains, behaviors, triggers and objections must be traceable to the evidence. Quotes must be copied verbatim from the evidence quotes given.
3. The name is a realistic label only (for example "Busy Dana"), never the name of a real interviewee.
4. summary: two sentences max. archetype: 3 to 6 words.
5. willingnessToPay: state what customers said about price, with numbers when present.
6. segments: list meaningful differences between interviewees (for example planners versus improvisers). Empty if all customers look alike.
7. confidence is 0 to 1, based on the number of distinct speakers and how consistent the evidence is.
Output JSON only: {"name": string, "archetype": string, "summary": string, "demographics": string, "goals": [string], "pains": [string], "behaviors": [string], "willingnessToPay": string, "triggers": [string], "objections": [string], "segments": [string], "quotes": [{"quote": string, "speaker": string}], "confidence": number}.`;

export const personaPrompt = (args: {
  project: { name: string; targetUser: string | null };
  items: { speaker: string | null; claim: string; quote: string | null; stance: string; assumption: string }[];
}) =>
  `PRODUCT: ${args.project.name}\nINTENDED USER: ${args.project.targetUser ?? "not specified"}\n\nEVIDENCE (speaker | claim | verbatim quote | stance toward assumption):\n${args.items
    .map((i) => `- ${i.speaker ?? "Unknown"} | ${i.claim} | ${i.quote ? `"${i.quote}"` : "(image)"} | ${i.stance} -> ${i.assumption}`)
    .join("\n")}`;

export const TRANSCRIBE_SYSTEM = `You are a precise speech-to-text engine. Transcribe the audio verbatim in the language spoken. Do not summarize, translate, or add commentary. If there is no intelligible speech, return an empty string for text.
Output JSON only: {"text": string}.`;
