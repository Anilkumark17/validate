import { sql } from "drizzle-orm";
import { db, schema } from "./db";

const { segment } = schema;

/**
 * Inserts one finalized segment. idx comes from a subselect in the same statement (one round trip);
 * a concurrent insert that picks the same idx hits segment_meeting_idx_uq and is retried.
 */
export async function addSegment(meetingId: string, input: { speaker: string; text: string; startSec?: number | null }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db()
        .insert(segment)
        .values({
          meetingId,
          idx: sql<number>`(select coalesce(max(${segment.idx}), -1) + 1 from ${segment} where ${segment.meetingId} = ${meetingId})`,
          speaker: input.speaker,
          text: input.text,
          startSec: input.startSec ?? null,
        })
        .returning();
      return row!;
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
  throw new Error("unreachable");
}
