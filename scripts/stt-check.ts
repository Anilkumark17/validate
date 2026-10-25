import { config } from "dotenv";
config({ path: ".env.local" });
import { generate } from "../src/server/llm/client";
import { env } from "../src/server/env";

async function main() {
  console.log("STT model:", env().STT_MODEL);
  const r = await generate({ model: env().STT_MODEL, system: "Reply with JSON {\"ok\":true}", parts: [{ text: "ping" }], minimalThinking: true });
  console.log(r.text, r.inputTokens, r.outputTokens);
}
main().catch((e) => { console.error(e); process.exit(1); });
