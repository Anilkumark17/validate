import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { ApiError } from "./http";
import { MAX_CONTEXT_ENTRIES, PROJECT_CONTEXT_TITLE } from "@/lib/schemas";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
const { projectContext } = schema;

const isMain = (projectId: string) => and(eq(projectContext.projectId, projectId), eq(projectContext.title, PROJECT_CONTEXT_TITLE));

/** Title of the note written from the setup aspect picker. Retries update this row instead of adding another. */
export const FOCUS_CONTEXT_TITLE = "Focus before generation";

/** Text of the project's main context entry, or "" when there is none. */
export async function readMainContext(projectId: string): Promise<string> {
  const [row] = await db().select({ content: projectContext.content }).from(projectContext).where(isMain(projectId)).orderBy(asc(projectContext.createdAt)).limit(1);
  return row?.content ?? "";
}

/**
 * Creates, updates or removes the single "Project context" entry (the textarea in the project form).
 * Empty text removes it. Other entries on the Context tab are never touched.
 */
export async function saveMainContext(tx: Tx, projectId: string, text: string) {
  const [existing] = await tx.select({ id: projectContext.id }).from(projectContext).where(isMain(projectId)).orderBy(asc(projectContext.createdAt)).limit(1);
  if (!text) {
    if (existing) await tx.delete(projectContext).where(eq(projectContext.id, existing.id));
    return;
  }
  if (existing) {
    await tx.update(projectContext).set({ content: text, updatedAt: new Date() }).where(eq(projectContext.id, existing.id));
    return;
  }
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(projectContext).where(eq(projectContext.projectId, projectId));
  if (n >= MAX_CONTEXT_ENTRIES) throw new ApiError(409, "context_limit", `A project can hold at most ${MAX_CONTEXT_ENTRIES} context entries`);
  await tx.insert(projectContext).values({ projectId, title: PROJECT_CONTEXT_TITLE, content: text });
}

/** Saves the aspects and note from setup. Empty input leaves any existing note alone. */
export async function saveFocusNote(projectId: string, aspects: string[], note: string) {
  const lines = [aspects.length ? `Aspects: ${aspects.join(", ")}` : "", note.trim()].filter(Boolean);
  if (!lines.length) return;
  const content = lines.join("\n\n").slice(0, 20_000);
  const where = and(eq(projectContext.projectId, projectId), eq(projectContext.title, FOCUS_CONTEXT_TITLE));
  const [existing] = await db().select({ id: projectContext.id }).from(projectContext).where(where).limit(1);
  if (existing) {
    await db().update(projectContext).set({ content, updatedAt: new Date() }).where(eq(projectContext.id, existing.id));
    return;
  }
  const [{ n }] = await db().select({ n: sql<number>`count(*)::int` }).from(projectContext).where(eq(projectContext.projectId, projectId));
  if (n >= MAX_CONTEXT_ENTRIES) return;
  await db().insert(projectContext).values({ projectId, title: FOCUS_CONTEXT_TITLE, content });
}
