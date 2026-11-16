/** Turns uploaded meeting notes (plain text or Markdown) into transcript segments. */

export interface NoteSegment {
  speaker: string | null;
  text: string;
  startSec: number | null;
}

export const MAX_NOTE_CHARS = 200_000;
export const MAX_NOTE_SEGMENTS = 600;
const MAX_PIECE = 1200;

// "Priya: text", "[00:12:30] Priya: text", "12:30 - Priya: text", "**Priya:** text"
const TURN = /^(?:\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–]?\s*)?\**([A-Za-zऀ-ൿ][\wऀ-ൿ .'()-]{0,40}?)\**\s*:\**\s+(.+)$/;
/** "Date: …" or "Agenda: …" is metadata, not someone speaking. */
const NOT_SPEAKERS = new Set(["date", "time", "when", "where", "location", "venue", "attendees", "participants", "present", "agenda", "subject", "topic", "title", "summary", "notes", "note", "action items", "actions", "next steps", "follow ups", "follow-ups", "decisions", "outcome", "duration", "company", "role", "email", "phone", "link", "url", "https", "http"]);
const TIME_ONLY = /^\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*[-–]?\s*(.+)$/;

function seconds(stamp: string | undefined) {
  if (!stamp) return null;
  const parts = stamp.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

/** Drops Markdown syntax that carries no meaning for the extract. */
function plain(line: string) {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .trim();
}

/** Splits a long piece on sentence ends so no segment is bigger than one chunk of the extract. */
function split(text: string): string[] {
  if (text.length <= MAX_PIECE) return [text];
  const out: string[] = [];
  let cur = "";
  for (const sentence of text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [text]) {
    if (cur && cur.length + sentence.length > MAX_PIECE) {
      out.push(cur.trim());
      cur = "";
    }
    cur += sentence;
    while (cur.length > MAX_PIECE) {
      out.push(cur.slice(0, MAX_PIECE).trim());
      cur = cur.slice(MAX_PIECE);
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Lines that look like "Name: text" become speaker turns; following lines without a name join that
 * turn until a blank line. Other text becomes one segment per paragraph with no speaker. Headings
 * stand alone. "Date:", "Agenda:" and similar labels are not treated as speakers.
 */
export function notesToSegments(raw: string): NoteSegment[] {
  const text = raw.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").slice(0, MAX_NOTE_CHARS);
  const items: NoteSegment[] = [];
  let cur: NoteSegment | null = null;
  const flush = () => {
    if (cur && cur.text.trim()) for (const piece of split(cur.text.trim())) items.push({ ...cur, text: piece });
    cur = null;
  };
  for (const rawLine of text.split("\n")) {
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(rawLine)) {
      flush();
      continue;
    }
    const line = plain(rawLine);
    if (!line) {
      flush();
      continue;
    }
    if (/^\s{0,3}#{1,6}\s/.test(rawLine)) {
      flush();
      cur = { speaker: null, text: line, startSec: null };
      flush();
      continue;
    }
    const turn = line.match(TURN);
    if (turn && !NOT_SPEAKERS.has(turn[2]!.trim().toLowerCase())) {
      flush();
      cur = { speaker: turn[2]!.trim(), text: turn[3]!, startSec: seconds(turn[1]) };
      continue;
    }
    const timed = line.match(TIME_ONLY);
    if (timed && !cur) {
      cur = { speaker: null, text: timed[2]!, startSec: seconds(timed[1]) };
      continue;
    }
    if (cur) cur.text += ` ${line}`;
    else cur = { speaker: null, text: line, startSec: null };
  }
  flush();
  return items.slice(0, MAX_NOTE_SEGMENTS);
}
