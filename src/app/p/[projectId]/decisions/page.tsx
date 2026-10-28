"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageState } from "@/components/app-shell";
import { StatusBadge } from "@/components/board/badges";
import { ProjectHeader } from "@/components/project-nav";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import type { DecisionRow } from "@/lib/board/client";

export default function DecisionsPage() {
  return (
    <RequireAuth>
      <Decisions />
    </RequireAuth>
  );
}

function Decisions() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, error } = useQuery({ queryKey: ["decisions", projectId], queryFn: () => api<DecisionRow[]>(`/projects/${projectId}/decisions`) });
  return (
    <>
      <main className="max-w-3xl">
        <ProjectHeader projectId={projectId} />
        <PageState loading={isLoading} error={error?.message} empty={data?.length === 0} emptyText="No decisions yet. Moving an assumption on the board records one." />
        <ol className="divide-y divide-rule overflow-hidden rounded-lg border bg-card empty:hidden">
          {data?.map((d) => (
            <li key={d.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="min-w-0 flex-1 basis-64 font-medium">{d.assumptionTitle}</p>
                <span className="num text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}{d.actorName ? ` · ${d.actorName}` : ""}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={d.fromStatus} /> <span aria-label="moved to">to</span> <StatusBadge status={d.toStatus} />
              </div>
              <p className="mt-2">{d.rationale}</p>
              {d.interpretation && <p className="mt-1 text-muted-foreground">Interpretation: {d.interpretation}</p>}
              {d.evidenceIds.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Based on <span className="num">{d.evidenceIds.length}</span> evidence record{d.evidenceIds.length === 1 ? "" : "s"}</p>}
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
