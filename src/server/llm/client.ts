import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { sql, eq } from "drizzle-orm";
import type { ZodType } from "zod";
import { db, schema } from "../db";
import { geminiKeys } from "../env";

const g = globalThis as unknown as {
  __clients?: Map<string, GoogleGenAI>;
  __keyIdx?: number;
  __jsonMode?: boolean;
  __thinkingOk?: boolean;
  __noThinkModels?: Set<string>;
};

function nextClient(): GoogleGenAI {
  const keys = geminiKeys();
  if (keys.length === 0) throw new LlmError("No GEMINI_API_KEYS configured", false);
  g.__keyIdx = ((g.__keyIdx ?? -1) + 1) % keys.length;
  const key = keys[g.__keyIdx]!;
  const cache = (g.__clients ??= new Map());
  let c = cache.get(key);
  if (!c) cache.set(key, (c = new GoogleGenAI({ apiKey: key })));
  return c;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export type Part = { text: string } | { inlineData: { data: string; mimeType: string } };

export interface GenerateOptions {
  model: string;
  system: string;
  parts: Part[];
  thinking?: boolean;
  /** Ask a thinking-capable model to think as little as possible (latency sensitive calls). */
  minimalThinking?: boolean;
  /** Model to use when the primary keeps failing (for example a 5xx from the hosted 31B). */
  fallbackModel?: string;
  /** Per request timeout. Defaults to 30 seconds. */
  timeoutMs?: number;
  meetingId?: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(e: unknown): number | undefined {
  if (e instanceof ApiError) return e.status;
  const s = (e as { status?: number })?.status;
  return typeof s === "number" ? s : undefined;
}

async function recordUsage(meetingId: string | null | undefined, input: number, output: number) {
  if (!meetingId) return;
  await db()
    .update(schema.meeting)
    .set({
      inputTokens: sql`${schema.meeting.inputTokens} + ${input}`,
      outputTokens: sql`${schema.meeting.outputTokens} + ${output}`,
      modelCalls: sql`${schema.meeting.modelCalls} + 1`,
    })
    .where(eq(schema.meeting.id, meetingId));
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/** Tries opts.model, then opts.fallbackModel once if the first model keeps failing. */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  try {
    return await generateOnce(opts);
  } catch (e) {
    if (!opts.fallbackModel || opts.fallbackModel === opts.model) throw e;
    console.warn(`[llm] ${opts.model} failed, falling back to ${opts.fallbackModel}`);
    return generateOnce({ ...opts, model: opts.fallbackModel, thinking: false, fallbackModel: undefined });
  }
}

async function generateOnce(opts: GenerateOptions): Promise<GenerateResult> {
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const client = nextClient();
    const useJson = g.__jsonMode !== false;
    const useThinking = !!opts.thinking && g.__thinkingOk !== false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
    try {
      const res = await client.models.generateContent({
        model: opts.model,
        contents: [{ role: "user", parts: opts.parts }],
        config: {
          systemInstruction: opts.system,
          abortSignal: ctrl.signal,
          ...(useJson ? { responseMimeType: "application/json" } : {}),
          ...(useThinking
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
            : opts.minimalThinking && !g.__noThinkModels?.has(opts.model)
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
        },
      });
      clearTimeout(timer);
      const text = res.text ?? "";
      const input = res.usageMetadata?.promptTokenCount ?? 0;
      const output = res.usageMetadata?.candidatesTokenCount ?? 0;
      await recordUsage(opts.meetingId, input, output).catch(() => {});
      return { text, inputTokens: input, outputTokens: output };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      const status = statusOf(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (status === 400 && useJson && /mime|json/i.test(msg)) {
        g.__jsonMode = false;
        console.warn("[llm] JSON mode unsupported, falling back to prompt-only JSON");
        attempt--;
        continue;
      }
      if (status === 400 && /think/i.test(msg) && (useThinking || opts.minimalThinking)) {
        if (useThinking) g.__thinkingOk = false;
        else (g.__noThinkModels ??= new Set()).add(opts.model);
        console.warn(`[llm] thinking level unsupported for ${opts.model}, disabling`);
        attempt--;
        continue;
      }
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt === maxAttempts - 1) break;
      const delay = Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300;
      await sleep(delay);
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new LlmError(`Model call failed: ${msg.slice(0, 300)}`, false);
}

export function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1]!;
  try {
    return JSON.parse(t);
  } catch {
    const start = t.search(/[[{]/);
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Response is not valid JSON");
  }
}

/** Generate, validate with Zod, retry once with the validation error appended. */
export async function generateJson<T>(opts: GenerateOptions, schemaZ: ZodType<T>): Promise<T> {
  const first = await generate(opts);
  try {
    return schemaZ.parse(parseJsonLoose(first.text));
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 800) : String(err);
    const retry = await generate({
      ...opts,
      parts: [...opts.parts, { text: `\n\nYour previous reply failed validation:\n${detail}\nReturn corrected JSON only.` }],
    });
    try {
      return schemaZ.parse(parseJsonLoose(retry.text));
    } catch (err2) {
      throw new LlmError(`Model output failed validation: ${(err2 as Error).message.slice(0, 300)}`, false);
    }
  }
}

export function llmMode() {
  return { jsonMode: g.__jsonMode !== false, thinking: g.__thinkingOk !== false };
}
