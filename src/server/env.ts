import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().default(""),
  LIVEKIT_URL: z.string().default(""),
  LIVEKIT_API_KEY: z.string().default(""),
  LIVEKIT_API_SECRET: z.string().default(""),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
