import { config } from "dotenv";
config({ path: ".env.local" });
import { GoogleGenAI } from "@google/genai";
async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEYS!.split(",")[0]!.trim() });
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  for await (const m of pager) {
    if (m.supportedActions?.includes("generateContent")) console.log(m.name);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
