export interface ParsedSegment {
  speaker: string | null;
  text: string;
  startSec: number | null;
}

function ts(s: string): number | null {
  const m = s.trim().replace(",", ".").match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function splitSpeaker(line: string): { speaker: string | null; text: string } {
  const v = line.match(/^<v\s+([^>]+)>(.*)$/i);
  if (v) return { speaker: v[1]!.trim(), text: v[2]!.replace(/<[^>]+>/g, "").trim() };
  const m = line.match(/^([A-Za-z][\w .'-]{0,40}):\s+(.+)$/);
  if (m) return { speaker: m[1]!.trim(), text: m[2]!.trim() };
  return { speaker: null, text: line.replace(/<[^>]+>/g, "").trim() };
}

export function parseTranscript(content: string): ParsedSegment[] {
  const text = content.replace(/\r/g, "").replace(/^﻿/, "");
  const out: ParsedSegment[] = [];
  const isTimed = /-->/.test(text);
  if (isTimed) {
    const blocks = text.split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const ti = lines.findIndex((l) => l.includes("-->"));
      if (ti < 0) continue;
      const start = ts(lines[ti]!.split("-->")[0]!);
      const body = lines.slice(ti + 1).join(" ").trim();
      if (!body) continue;
      const { speaker, text: t } = splitSpeaker(body);
      if (t) out.push({ speaker, text: t, startSec: start });
    }
    return out;
  }
  let t = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || /^WEBVTT/i.test(line)) continue;
    const { speaker, text: body } = splitSpeaker(line);
    if (!body) continue;
    out.push({ speaker, text: body, startSec: t });
    t += 12;
  }
  return out;
}
