import { env } from "./env";

/** Speech to text failed in a way the client should react to (switch to browser speech recognition). */
export class SttError extends Error {
  constructor(
    message: string,
    public status: number,
    /** true: not configured / bad key / quota. The client should fall back at once. */
    public fatal: boolean,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_ATTEMPTS = 3;

export const isTransient = (status: number) => status === 429 || status >= 500;

export function retryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const ra = Number(retryAfterHeader);
  if (Number.isFinite(ra) && ra > 0) return Math.min(5000, Math.ceil(ra * 1000));
  return 300 * 2 ** attempt + Math.random() * 200;
}

/** Sarvam speech to text (batch, up to 30 s of audio). The key never leaves the server. */
export async function transcribeSarvam(audio: Blob): Promise<{ text: string; ms: number; retries: number }> {
  const { SARVAM_API, SARVAM_MODEL, SARVAM_LANGUAGE } = env();
  if (!SARVAM_API) throw new SttError("SARVAM_API is not configured", 503, true);
  const started = Date.now();
  let lastErr = "";
  let lastStatus = 502;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const form = new FormData();
    form.append("file", audio, "chunk.wav");
    form.append("model", SARVAM_MODEL);
    form.append("language_code", SARVAM_LANGUAGE);
    let retryAfter: string | null = null;
    try {
      const res = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: { "api-subscription-key": SARVAM_API },
        body: form,
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const j = (await res.json()) as { transcript?: string };
        return { text: (j.transcript ?? "").trim(), ms: Date.now() - started, retries: attempt };
      }
      lastStatus = res.status;
      lastErr = `${res.status} ${(await res.text()).slice(0, 160)}`;
      // 401/403 bad key, 402/429 quota, 4xx bad request: retrying will not help, fall back at once.
      if (res.status === 429 && attempt < MAX_ATTEMPTS - 1) retryAfter = res.headers.get("retry-after");
      else if (!isTransient(res.status)) throw new SttError(`Sarvam rejected the request: ${lastErr}`, res.status, true);
      else retryAfter = res.headers.get("retry-after");
    } catch (e) {
      if (e instanceof SttError) throw e;
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < MAX_ATTEMPTS - 1) await sleep(retryDelayMs(attempt, retryAfter));
  }
  throw new SttError(`Sarvam is unavailable: ${lastErr}`, lastStatus === 429 ? 429 : 502, false);
}
