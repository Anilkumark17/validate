"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageState } from "@/components/app-shell";
import { EvidenceDrawer } from "@/components/evidence-drawer";
import { ImportDialog, NewMeetingDialog } from "@/components/meeting-dialogs";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { api, type Assumption } from "@/lib/api";
import { STATUS_META, STATUS_ORDER, TYPE_LABEL } from "@/lib/status-meta";
import { useProjectEvents } from "@/lib/use-project-events";

function Card({ a, flash, onOpen }: { a: Assumption; flash: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/50 ${flash ? "flash" : ""}`}
    >
      <p className="text-sm leading-snug">{a.statement}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full bg-muted px-2 py-0.5">{TYPE_LABEL[a.type]}</span>
        <span className="text-muted-foreground" title="Risk if wrong">Risk {a.risk}/5</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Confidence"
          aria-valuenow={Math.round(a.confidence * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className={`h-full ${STATUS_META[a.status].dot}`} style={{ width: `${a.confidence * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{Math.round(a.confidence * 100)}%</span>
      </div>
    </button>
  );
}

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const key = ["assumptions", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<Assumption[]>(`/projects/${projectId}/assumptions`) });

  useProjectEvents(projectId, (ev, d) => {
    if (ev === "assumption.updated") {
      if (d.deleted) qc.setQueryData<Assumption[]>(key, (old) => old?.filter((a) => a.id !== d.deleted));
      else if (d.assumption) {
        const next = d.assumption as Assumption;
        qc.setQueryData<Assumption[]>(key, (old) => (old ? old.map((a) => (a.id === next.id ? next : a)) : old));
        setFlash((f) => ({ ...f, [next.id]: true }));
        setTimeout(() => setFlash((f) => ({ ...f, [next.id]: false })), 1200);
      }
      qc.invalidateQueries({ queryKey: ["evidence", d.assumption?.id] });
    }
    if (ev === "meeting.updated" || ev === "meeting.ended") qc.invalidateQueries({ queryKey: ["meetings", projectId] });
  });

  const selected = data?.find((a) => a.id === open) ?? null;

  return (
    <>
      <ProjectHeader projectId={projectId}>
        <Button variant="outline" asChild>
          <Link href={`/p/${projectId}/assumptions/new`}>
            <Plus /> Add assumption
          </Link>
        </Button>
        <ImportDialog projectId={projectId} />
        <NewMeetingDialog projectId={projectId} goLive />
      </ProjectHeader>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <PageState loading={isLoading} error={error?.message} empty={data?.length === 0} emptyText="No assumptions yet. Add one or draft them from your PRD." />
        {data && data.length > 0 && (
          <div className="grid gap-4 overflow-x-auto pb-4 md:grid-cols-3 xl:grid-cols-6">
            {STATUS_ORDER.map((s) => {
              const items = data.filter((a) => a.status === s);
              const M = STATUS_META[s];
              const Icon = M.icon;
              return (
                <section key={s} aria-label={`${M.label} column`} className="min-w-[210px] rounded-lg bg-muted/60 p-2">
                  <h2 className={`mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide ${M.text}`}>
                    <Icon className="size-3.5" aria-hidden /> {M.label}
                    <span className="ml-auto rounded-full bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((a) => (
                      <Card key={a.id} a={a} flash={!!flash[a.id]} onOpen={() => setOpen(a.id)} />
                    ))}
                    {items.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">Empty</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      <EvidenceDrawer assumption={selected} onClose={() => setOpen(null)} />
    </>
  );
}
