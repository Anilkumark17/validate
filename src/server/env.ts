import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().default(""),
  /** Sarvam speech to text. Unset means the clients use the browser's speech recognition. */
  SARVAM_API: z.string().default(""),
  SARVAM_MODEL: z.string().default("saaras:v4"),
  /** BCP-47 code such as en-IN or hi-IN. "unknown" auto-detects. */
  SARVAM_LANGUAGE: z.string().default("unknown"),
  /** GLM (Zhipu) for assumption, stakeholder and interview guide generation. Server side only. */
  GLM_API: z.string().default(""),
  GLM_BASE_URL: z.string().default("https://open.bigmodel.cn/api/paas/v4"),
  GLM_MODEL: z.string().default("glm-4.6"),
  /** Used when the main model keeps failing. */
  GLM_MODEL_FALLBACK: z.string().default("glm-4.5-flash"),
  LIVEKIT_URL: z.string().default(""),
  LIVEKIT_API_KEY: z.string().default(""),
  LIVEKIT_API_SECRET: z.string().default(""),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
