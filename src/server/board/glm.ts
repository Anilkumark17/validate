import type { ZodType } from "zod";
import { env } from "../env";

/** GLM failed in a way the caller should report. Messages never contain the API key. */
export class GlmError extends Error {
  constructor(
    message: string,
    /** true: retrying cannot help (bad key, bad request) */
    public fatal = false,
    /** true: the request is bigger than the provider allows; the caller should send less */
    public tooLarge = false,
  ) {
    super(message);
  }
}

export interface GlmDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** override env for tests */
  config?: { apiKey: string; baseUrl: string; model: string; fallbackModel: string; tpm?: number };
}

/** Same rough estimate the extract chunker uses: one token per three characters. */
export function requestTokens(a: { system: string; user: string; maxTokens?: number }) {
  return Math.ceil((a.system.length + a.user.length) / 3) + (a.maxTokens ?? 7000);
}

/** Tokens sent per model in the last minute, so calls wait instead of hitting the per-minute limit. */
type SentLog = Map<string, { at: number; tokens: number }[]>;
const sent: SentLog = ((globalThis as unknown as { __glmSent?: SentLog }).__glmSent ??= new Map());

async function pace(model: string, tokens: number, tpm: number, sleep: (ms: number) => Promise<void>) {
  if (!tpm) return;
  const budget = Math.min(tokens, tpm);
  for (;;) {
    const now = Date.now();
    const log = (sent.get(model) ?? []).filter((x) => now - x.at < 60_000);
    const used = log.reduce((n, x) => n + x.tokens, 0);
    if (used + budget <= tpm || log.length === 0) {
      log.push({ at: now, tokens: budget });
      sent.set(model, log);
      return;
    }
    await sleep(Math.max(500, 60_000 - (now - log[0]!.at) + 250));
  }
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MAX_HTTP_ATTEMPTS = 3;
const TIMEOUT_MS = 120_000;

export const isTransientStatus = (s: number) => s === 429 || s >= 500;

export function backoffMs(attempt: number, retryAfter: string | null): number {
  const ra = Number(retryAfter);
  if (Number.isFinite(ra) && ra > 0) return Math.min(30_000, Math.ceil(ra * 1000));
  return Math.min(8000, 700 * 2 ** attempt + Math.random() * 300);
}

function config(deps?: GlmDeps) {
  if (deps?.config) return deps.config;
  const e = env();
  return { apiKey: e.GLM_API, baseUrl: e.GLM_BASE_URL, model: e.GLM_MODEL, fallbackModel: e.GLM_MODEL_FALLBACK, tpm: e.GLM_TPM };
}

interface ChatArgs {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

function isAbort(e: unknown) {
  return e instanceof Error && e.name === "AbortError";
}

async function chatOnce(model: string, a: ChatArgs, deps?: GlmDeps): Promise<{ text: string; model: string }> {
  const cfg = config(deps);
  if (!cfg.apiKey) throw new GlmError("GLM_API is not configured", true);
  const f = deps?.fetch ?? fetch;
  const sleep = deps?.sleep ?? realSleep;
  let last = "";
  for (let attempt = 0; attempt < MAX_HTTP_ATTEMPTS; attempt++) {
    if (a.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    let retryAfter: string | null = null;
    await pace(model, requestTokens(a), cfg.tpm ?? 0, sleep);
    try {
      const res = await f(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
        signal: a.signal ? AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), a.signal]) : AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: a.system },
            { role: "user", content: a.user },
          ],
          temperature: a.temperature ?? 0.4,
          max_tokens: a.maxTokens ?? 7000,
          response_format: { type: "json_object" },
          ...(cfg.baseUrl.includes("groq.com") ? (model.includes("gpt-oss") ? { reasoning_effort: "low" } : model.includes("qwen") ? { reasoning_effort: "none" } : {}) : { thinking: { type: "disabled" } }),
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
        const text = j.choices?.[0]?.message?.content ?? "";
        if (!text) throw new GlmError("GLM returned an empty reply");
        if (j.choices?.[0]?.finish_reason === "length") throw new GlmError("GLM reply was cut off (too long)");
        return { text, model };
      }
      last = `${res.status} ${(await res.text()).slice(0, 160)}`;
      if (res.status === 413) throw new GlmError(`GLM request is too large: ${last}`, true, true);
      if (!isTransientStatus(res.status)) throw new GlmError(`GLM rejected the request: ${last}`, true);
      retryAfter = res.headers.get("retry-after");
    } catch (e) {
      if (isAbort(e) || a.signal?.aborted) throw e instanceof Error ? e : new DOMException("Aborted", "AbortError");
      if (e instanceof GlmError && (e.fatal || /empty|cut off/.test(e.message))) throw e;
      last = e instanceof Error ? e.message : String(e);
    }
    if (attempt < MAX_HTTP_ATTEMPTS - 1) await sleep(backoffMs(attempt, retryAfter));
  }
  throw new GlmError(`GLM is unavailable: ${last}`);
}

/** Main model first, then the fallback model once if the main one keeps failing for transient reasons. */
export async function glmChat(a: ChatArgs, deps?: GlmDeps): Promise<{ text: string; model: string }> {
  const cfg = config(deps);
  try {
    return await chatOnce(cfg.model, a, deps);
  } catch (e) {
    if (e instanceof GlmError && e.fatal) throw e;
    if (!cfg.fallbackModel || cfg.fallbackModel === cfg.model) throw e;
    return chatOnce(cfg.fallbackModel, a, deps);
  }
}

export function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1]!;
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Reply is not valid JSON");
  }
}

export interface JsonResult<T> {
  data: T;
  /** model calls made, including validation retries */
  attempts: number;
  model: string;
}

/**
 * Asks for JSON, validates it with Zod, and re-asks with the validation errors a bounded number of
 * times. Model output is untrusted: it is only ever parsed, never executed.
 */
export async function glmJson<T>(
  schema: ZodType<T>,
  args: ChatArgs,
  opts: { validationRetries?: number } = {},
  deps?: GlmDeps,
): Promise<JsonResult<T>> {
  const maxRetries = opts.validationRetries ?? 2;
  let user = args.user;
  let lastIssue = "";
  for (let i = 0; i <= maxRetries; i++) {
    if (args.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const r = await glmChat({ ...args, user }, deps);
    try {
      const parsed = schema.safeParse(parseJsonLoose(r.text));
      if (parsed.success) return { data: parsed.data, attempts: i + 1, model: r.model };
      lastIssue = parsed.error.issues
        .slice(0, 8)
        .map((x) => `${x.path.join(".") || "root"}: ${x.message}`)
        .join("; ");
    } catch (e) {
      lastIssue = e instanceof Error ? e.message : String(e);
    }
    user = `${args.user}\n\nYour previous reply was rejected: ${lastIssue}\nFix every problem and return the complete corrected JSON object only.`;
  }
  throw new GlmError(`GLM output failed validation after ${maxRetries + 1} attempts: ${lastIssue.slice(0, 300)}`);
}
