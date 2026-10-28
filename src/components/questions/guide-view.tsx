"use client";
import { ArrowRight, Copy, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyText, QuestionRow } from "./question-row";

export interface GuideContent {
  assumptionsToTest: { assumptionId: string; whyItIsRisky: string }[];
  acts: { act: number; name: string; goal: string; questions: { text: string; assumptionId?: string | null; followUps: string[]; ladder: string }[] }[];
  coachNotes: string[];
}
export interface Guide {
  id: string;
  stakeholderId: string | null;
  title: string;
  content: GuideContent;
  createdAt: string;
}

const SHORT = ["Welcome", "Context", "Core", "Wrap-up", "Unknowns"];

/** Which questions were asked lives in this browser only. It is a working checklist, not a record. */
export function useAsked(key: string) {
  const storageKey = `asked:${key}`;
  const [asked, setAsked] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setAsked(new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]")));
    } catch {
      setAsked(new Set());
    }
  }, [storageKey]);
  const save = (s: Set<string>) => {
    setAsked(s);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...s]));
    } catch {}
  };
  return {
    asked,
    toggle: (id: string) => {
      const n = new Set(asked);
      n.has(id) ? n.delete(id) : n.add(id);
      save(n);
    },
    reset: () => save(new Set()),
  };
}

function guideText(g: Guide, titleOf: Map<string, string>): string {
  const lines = [g.title, ""];
  for (const a of g.content.acts) {
    lines.push(`Act ${a.act}: ${a.name}`, a.goal);
    for (const q of a.questions) {
      lines.push(`- ${q.text}${q.assumptionId && titleOf.get(q.assumptionId) ? `  [tests: ${titleOf.get(q.assumptionId)}]` : ""}`);
      for (const f of q.followUps) lines.push(`    follow-up: ${f}`);
    }
    lines.push("");
  }
  lines.push("Coach notes", ...g.content.coachNotes.map((n) => `- ${n}`));
  return lines.join("\n");
}

export function GuideView({
  guide,
  roleName,
  titleOf,
  projectId,
  onDelete,
  deleting,
}: {
  guide: Guide;
  roleName: string;
  titleOf: Map<string, string>;
  projectId: string;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { asked, toggle, reset } = useAsked(guide.id);
  const acts = guide.content.acts;
  const [tab, setTab] = useState(`act-${acts.find((a) => a.questions.some((q) => !asked.has(`${a.act}:${q.text}`)))?.act ?? 1}`);
  const total = acts.reduce((n, a) => n + a.questions.length, 0);
  const done = acts.reduce((n, a) => n + a.questions.filter((q) => asked.has(`${a.act}:${q.text}`)).length, 0);
  const order = [...acts.map((a) => `act-${a.act}`), "notes"];
  const idx = order.indexOf(tab);
  const nextLabel = idx >= 0 && idx < order.length - 1 ? (order[idx + 1] === "notes" ? "Coach notes" : SHORT[acts[idx + 1]!.act - 1]) : null;
  const whyRisky = useMemo(() => new Map(guide.content.assumptionsToTest.map((a) => [a.assumptionId, a.whyItIsRisky])), [guide]);

  return (
    <section aria-label={`Interview guide for ${roleName}`} className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm">
            <span className="num font-medium">{done}</span> <span className="text-muted-foreground">of <span className="num">{total}</span> asked</span>
            {done > 0 && (
              <button type="button" className="ml-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={reset}>
                Reset
              </button>
            )}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Questions asked">
            <div className="h-full bg-chart transition-[width]" style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copyText(guideText(guide, titleOf), "Guide copied")}>
            <Copy /> Copy all
          </Button>
          <Button size="sm" asChild>
            <Link href={`/p/${projectId}/meetings`}>
              <Video /> Start a call
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Delete this guide" disabled={deleting} onClick={() => confirm("Delete this guide?") && onDelete()}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="overflow-x-auto px-3" aria-label="Acts of the interview">
          {acts.map((a) => {
            const n = a.questions.length;
            const left = a.questions.filter((q) => !asked.has(`${a.act}:${q.text}`)).length;
            return (
              <TabsTrigger key={a.act} value={`act-${a.act}`} className="flex-none whitespace-nowrap px-3.5">
                {SHORT[a.act - 1] ?? a.name} <span className="num ml-1 text-xs font-normal text-muted-foreground">{left === 0 && n > 0 ? "done" : n}</span>
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="notes" className="flex-none whitespace-nowrap px-3.5">
            Coach notes
          </TabsTrigger>
        </TabsList>

        {acts.map((a) => {
          // Act 3 goes after the assumptions, so group its questions under the belief each one tests.
          const groups = a.act === 3 ? [...new Set(a.questions.map((q) => q.assumptionId ?? ""))] : [""];
          return (
            <TabsContent key={a.act} value={`act-${a.act}`} className="px-5 pb-5 pt-4">
              <p className="mb-1 line-clamp-2 text-sm text-muted-foreground" title={a.goal}>{a.goal}</p>
              {groups.map((gid) => {
                const qs = a.act === 3 ? a.questions.filter((q) => (q.assumptionId ?? "") === gid) : a.questions;
                return (
                  <div key={gid || "all"} className="mt-3">
                    {a.act === 3 && gid && (
                      <div className="mb-1">
                        <h3 className="text-sm font-medium">{titleOf.get(gid) ?? "Assumption"}</h3>
                        {whyRisky.get(gid) && <p className="line-clamp-1 text-xs text-muted-foreground" title={whyRisky.get(gid)}>{whyRisky.get(gid)}</p>}
                      </div>
                    )}
                    <ul className="divide-y divide-rule">
                      {qs.map((q) => (
                        <QuestionRow
                          key={q.text}
                          text={q.text}
                          followUps={q.followUps}
                          asked={asked.has(`${a.act}:${q.text}`)}
                          onToggle={() => toggle(`${a.act}:${q.text}`)}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </TabsContent>
          );
        })}

        <TabsContent value="notes" className="px-5 pb-5 pt-4">
          <ul className="space-y-2.5">
            {guide.content.coachNotes.map((n) => (
              <li key={n} className="flex gap-2.5 text-[15px] leading-6">
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      {nextLabel && (
        <div className="flex justify-end border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => setTab(order[idx + 1]!)}>
            Next: {nextLabel} <ArrowRight />
          </Button>
        </div>
      )}
    </section>
  );
}
