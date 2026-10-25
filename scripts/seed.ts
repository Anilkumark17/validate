import { config } from "dotenv";
config({ path: ".env.local" });
import { eq } from "drizzle-orm";
import { db, schema } from "../src/server/db";
import { geminiKeys } from "../src/server/env";
import { insertSegments, runMeeting } from "../src/server/pipeline";
import { newInviteCode } from "../src/server/queries";
import { parseTranscript } from "../src/server/transcript";
import { SEED_ASSUMPTIONS, SEED_MEETINGS, SEED_PROJECT } from "./seed-data";

async function main() {
  const existing = await db().select().from(schema.project).where(eq(schema.project.name, SEED_PROJECT.name));
  if (existing.length) {
    console.log("Seed project already exists, skipping.");
    process.exit(0);
  }
  if (geminiKeys().length === 0) {
    console.error("GEMINI_API_KEYS is empty in .env.local. The seed runs real model analysis, so a key is required.");
    process.exit(1);
  }
  const [project] = await db().insert(schema.project).values(SEED_PROJECT).returning();
  await db()
    .insert(schema.assumption)
    .values(SEED_ASSUMPTIONS.map((a) => ({ ...a, projectId: project!.id })));
  console.log(`Project ${project!.id}: ${SEED_ASSUMPTIONS.length} assumptions`);

  for (const m of SEED_MEETINGS) {
    const segs = parseTranscript(m.transcript);
    const speakers = [...new Set(segs.map((s) => s.speaker).filter((s): s is string => !!s))];
    const [meeting] = await db()
      .insert(schema.meeting)
      .values({
        projectId: project!.id,
        title: m.title,
        inviteCode: newInviteCode(),
        source: "transcript_upload",
        state: "ended",
        participants: speakers,
        heldAt: new Date().toISOString().slice(0, 10),
        endedAt: new Date(),
      })
      .returning();
    await insertSegments(meeting!.id, segs);
    console.log(`Analyzing "${m.title}" (${segs.length} lines)...`);
    await runMeeting(meeting!.id);
    const [done] = await db().select().from(schema.meeting).where(eq(schema.meeting.id, meeting!.id));
    console.log(`  job ${done!.jobStatus}${done!.jobError ? `: ${done!.jobError}` : ""}, ${done!.modelCalls} calls`);
  }
  const rows = await db().select().from(schema.assumption).where(eq(schema.assumption.projectId, project!.id));
  for (const a of rows) console.log(`${a.status.padEnd(12)} ${a.statement}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
