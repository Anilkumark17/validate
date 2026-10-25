import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEYS: z.string().default(""),
  GEMMA_MODEL_JUDGE: z.string().default("gemma-4-31b-it"),
  GEMMA_MODEL_FAST: z.string().default("gemma-4-26b-a4b-it"),
  STT_MODEL: z.string().default("gemini-3.5-flash-lite"),
  LIVEKIT_URL: z.string().default(""),
  LIVEKIT_API_KEY: z.string().default(""),
  LIVEKIT_API_SECRET: z.string().default(""),
  UPLOAD_DIR: z.string().default("./uploads"),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function geminiKeys(): string[] {
  return env()
    .GEMINI_API_KEYS.split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}
