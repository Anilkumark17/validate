import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireProject } from "@/server/auth";
import { db, schema } from "@/server/db";
import { ApiError, handle, rateLimit } from "@/server/http";
import { assertCanCreateMeeting } from "@/server/limits";
import { createMeeting } from "@/server/queries";
import { notesToSegments } from "@/lib/notes-parse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const TEXT_TYPES = ["txt", "md", "markdown"];

async function readText(file: File, ext: string) {
  if (ext === "pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer());
}

/**
 * Offline meeting notes: a .pdf, .txt or .md file becomes an ended meeting with its text as the
 * transcript, so Extract works on it the same way as on a live call.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  rateLimit(req, "notes_upload", 10);
  const { id } = await ctx.params;
  const { user } = await requireProject(req, id);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, "no_file", "Choose a .pdf, .txt or .md file");
  if (file.size > MAX_BYTES) throw new ApiError(413, "too_large", "The file is over 5 MB");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext !== "pdf" && !TEXT_TYPES.includes(ext)) throw new ApiError(400, "bad_type", "Only .pdf, .txt and .md files are supported");
  const title = String(form.get("title") ?? "").trim().slice(0, 160) || file.name.replace(/\.[^.]+$/, "").slice(0, 160);
  const heldRaw = String(form.get("heldAt") ?? "");
  const heldAt = /^\d{4}-\d{2}-\d{2}$/.test(heldRaw) ? heldRaw : new Date().toISOString().slice(0, 10);

  let text: string;
  try {
    text = await readText(file, ext);
  } catch {
    throw new ApiError(400, "unreadable", "Could not read text from this file. A scanned PDF has no text; upload a .txt or .md instead.");
  }
  const segments = notesToSegments(text);
  if (segments.length === 0) throw new ApiError(400, "empty", "The file has no text to use as notes");

  await assertCanCreateMeeting(user);
  const m = await createMeeting(id, { title, source: "transcript_upload", state: "ended", heldAt, endedAt: new Date() });
  const speakers = [...new Set(segments.map((s) => s.speaker).filter((s): s is string => !!s))].slice(0, 20);
  await db().transaction(async (tx) => {
    await tx.insert(schema.segment).values(
      segments.map((s, idx) => ({ meetingId: m.id, idx, speaker: s.speaker ?? "Notes", text: s.text, startSec: s.startSec, processed: true })),
    );
    if (speakers.length) await tx.update(schema.meeting).set({ participants: speakers }).where(eq(schema.meeting.id, m.id));
  });
  return NextResponse.json({ ...m, participants: speakers, segments: segments.length }, { status: 201 });
});
