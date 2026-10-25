import { config } from "dotenv";
config({ path: ".env.local" });
import { mapIdea, extractFacts } from "../src/server/llm/tasks";

async function main() {
  const t = Date.now();
  const r = await mapIdea({ idea: "An app that plans weeknight dinners and builds the grocery list for busy parents.", customer: "Working parents with kids under 10" });
  console.log(`map ${Math.round((Date.now() - t) / 1000)}s: ${r.assumptions.length} assumptions, leaps ${r.assumptions.filter((a) => a.leapOfFaith).length}`);
  console.log(r.assumptions[0]);
  const f = await extractFacts({
    meetingId: "00000000-0000-0000-0000-000000000000",
    segments: [{ idx: 0, speaker: "Priya", text: "Honestly, it was pasta again. I got home at six thirty and had no idea what to make, so I just boiled pasta and opened a jar." }],
  });
  console.log(JSON.stringify(f, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
