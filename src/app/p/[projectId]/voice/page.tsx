"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Languages, Megaphone } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { useProjectEvents } from "@/lib/use-project-events";

interface Fact {
  id: string;
  kind: string;
  statement: string;
  quote: string | null;
  speaker: string | null;
  phrases: string[];
  outboundTest: string | null;
  meetingId: string;
  meetingTitle: string;
}
interface Voice {
  language: string;
  tone: { register: string; sentenceStyle: string; temperature: string; humor: string; distrusts: string[] };
  phrasebook: { phrase: string; meaning: string }[];
  doSay: string[];
  dontSay: string[];
  outboundDrafts: { channel: string; subject: string; message: string; factId: string; hypothesis: string }[];
}

const KINDS = ["all", "behavior", "pain", "goal", "constraint", "language", "tone"] as const;

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
}

export default function VoicePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const facts = useQuery({ queryKey: ["facts", projectId], queryFn: () => api<Fact[]>(`/projects/${projectId}/facts`) });
  const voice = useQuery({ queryKey: ["voice", projectId], queryFn: () => api<{ voice: Voice | null; updatedAt: string | null }>(`/projects/${projectId}/voice`) });
  const build = useMutation({
    mutationFn: () => api<{ voice: Voice; updatedAt: string }>(`/projects/${projectId}/voice`, { method: "POST" }),
    onSuccess: (r) => qc.setQueryData(["voice", projectId], r),
    onError: (e: Error) => toast.error(e.message),
  });
  useProjectEvents(projectId, (ev) => {
    if (ev === "fact.added") qc.invalidateQueries({ queryKey: ["facts", projectId] });
  });

  const v = voice.data?.voice;
  const shown = facts.data?.filter((f) => kind === "all" || f.kind === kind) ?? [];
  const factById = new Map(facts.data?.map((f) => [f.id, f]));

  return (
    <>
      <ProjectHeader projectId={projectId}>
        <Button onClick={() => build.mutate()} disabled={build.isPending}>
          <Languages /> {build.isPending ? "Studying how they talk…" : v ? "Rebuild voice guide" : "Build voice guide"}
        </Button>
      </ProjectHeader>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2">
        <section aria-labelledby="facts">
          <h2 id="facts" className="text-lg font-semibold">Customer facts</h2>
          <p className="mb-3 text-sm text-muted-foreground">Behavior and language captured from calls. Each carries a cheap outbound test.</p>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by kind">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn("rounded-full border px-3 py-1 text-xs capitalize", kind === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {k}
              </button>
            ))}
          </div>
          <PageState loading={facts.isLoading} error={facts.error?.message} empty={facts.data?.length === 0} emptyText="No facts yet. They appear after calls or imported transcripts are analyzed." />
          <ul className="space-y-3">
            {shown.map((f) => (
              <li key={f.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{f.kind}</span>
                  <span className="text-muted-foreground">{f.speaker} · {f.meetingTitle}</span>
                </div>
                <p>{f.statement}</p>
                {f.quote && <blockquote className="mt-1 text-muted-foreground">“{f.quote}”</blockquote>}
                {f.phrases.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {f.phrases.map((p) => <span key={p} className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{p}</span>)}
                  </p>
                )}
                {f.outboundTest && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-muted/60 p-2 text-xs">
                    <Megaphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="flex-1">{f.outboundTest}</span>
                    <button aria-label="Copy outbound test" onClick={() => copy(f.outboundTest!)}><Copy className="size-3.5" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="voice" className="space-y-4">
          <div>
            <h2 id="voice" className="text-lg font-semibold">Voice guide</h2>
            <p className="text-sm text-muted-foreground">
              How they talk, and outbound drafts in their language.
              {voice.data?.updatedAt ? ` Updated ${timeAgo(voice.data.updatedAt)}.` : ""}
            </p>
          </div>
          {!v && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Build the guide once you have a few facts.</div>}
          {v && (
            <>
              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Language and tone</p>
                <p className="mt-1"><b>{v.language}</b>. {v.tone.register}. {v.tone.sentenceStyle}. {v.tone.temperature}. {v.tone.humor}</p>
                {v.tone.distrusts.length > 0 && <p className="mt-1 text-muted-foreground">Distrusts: {v.tone.distrusts.join(", ")}</p>}
              </div>
              {v.phrasebook.length > 0 && (
                <div className="rounded-lg border bg-card p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phrasebook</p>
                  <dl className="space-y-1.5 text-sm">
                    {v.phrasebook.map((p) => (
                      <div key={p.phrase}><dt className="inline font-medium">“{p.phrase}”</dt> <dd className="inline text-muted-foreground">{p.meaning}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">Say</p>
                  <ul className="list-disc space-y-1 pl-4 text-sm">{v.doSay.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-600">Avoid</p>
                  <ul className="list-disc space-y-1 pl-4 text-sm">{v.dontSay.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outbound drafts</p>
                <ul className="space-y-3">
                  {v.outboundDrafts.map((d, i) => (
                    <li key={i} className="rounded-lg border bg-card p-4 text-sm">
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-muted px-2 py-0.5 capitalize">{d.channel.replace("_", " ")}</span>
                        <button className="ml-auto" aria-label="Copy draft" onClick={() => copy(d.subject ? `${d.subject}\n\n${d.message}` : d.message)}><Copy className="size-3.5" /></button>
                      </div>
                      {d.subject && <p className="font-medium">{d.subject}</p>}
                      <p className="whitespace-pre-wrap">{d.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tests: {d.hypothesis}
                        {factById.get(d.factId) ? ` (fact: ${factById.get(d.factId)!.statement})` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}
