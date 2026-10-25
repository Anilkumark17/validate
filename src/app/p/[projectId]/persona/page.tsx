"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Quote, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/utils";

interface Persona {
  name: string;
  archetype: string;
  summary: string;
  demographics: string;
  goals: string[];
  pains: string[];
  behaviors: string[];
  willingnessToPay: string;
  triggers: string[];
  objections: string[];
  segments: string[];
  quotes: { quote: string; speaker: string }[];
  confidence: number;
  speakerCount?: number;
}
interface PersonaRes {
  persona: Persona | null;
  updatedAt: string | null;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}

export default function PersonaPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const key = ["persona", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<PersonaRes>(`/projects/${projectId}/persona`) });
  const build = useMutation({
    mutationFn: () => api<PersonaRes>(`/projects/${projectId}/persona`, { method: "POST" }),
    onSuccess: (r) => qc.setQueryData(key, r),
    onError: (e: Error) => toast.error(e.message),
  });
  const p = data?.persona;

  return (
    <>
      <ProjectHeader projectId={projectId}>
        <Button onClick={() => build.mutate()} disabled={build.isPending}>
          <Sparkles /> {build.isPending ? "Analyzing interviews…" : p ? "Rebuild persona" : "Build persona"}
        </Button>
      </ProjectHeader>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <PageState loading={isLoading} error={error?.message} />
        {data && !p && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No persona yet. Analyze at least one interview, then build a persona from the evidence.
          </div>
        )}
        {p && (
          <>
            <div className="rounded-xl border bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">{p.archetype}</p>
              <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{p.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {p.demographics} · Confidence {Math.round(p.confidence * 100)}%
                {p.speakerCount ? ` · based on ${p.speakerCount} speaker${p.speakerCount === 1 ? "" : "s"}` : ""}
                {data.updatedAt ? ` · updated ${timeAgo(data.updatedAt)}` : ""}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <List title="Goals" items={p.goals} />
              <List title="Pains" items={p.pains} />
              <List title="Behaviors" items={p.behaviors} />
              <List title="Triggers" items={p.triggers} />
              <List title="Objections" items={p.objections} />
              <List title="Where customers differ" items={p.segments} />
            </div>
            <section className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Willingness to pay</h3>
              <p className="text-sm">{p.willingnessToPay}</p>
            </section>
            {p.quotes.length > 0 && (
              <section aria-labelledby="pq">
                <h2 id="pq" className="mb-2 text-lg font-semibold">In their words</h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {p.quotes.map((q) => (
                    <li key={q.quote} className="rounded-lg border bg-card p-4 text-sm">
                      <Quote className="mb-1 size-4 text-muted-foreground" aria-hidden />
                      “{q.quote}”
                      <p className="mt-1 text-xs text-muted-foreground">{q.speaker}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
