import { config } from "dotenv";
config({ path: ".env.local" });
import { describeImage } from "../src/server/llm/tasks";
import { llmMode } from "../src/server/llm/client";

// 1x1 white PNG, enough to prove the call path, JSON mode and usage accounting.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

async function main() {
  const out = await describeImage({
    imageBase64: PNG,
    mimeType: "image/png",
    assumptions: [{ id: "00000000-0000-0000-0000-000000000001", statement: "Parents plan meals weekly.", type: "desirability" }],
  });
  console.log(JSON.stringify(out, null, 2));
  console.log("llm mode:", llmMode());
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
