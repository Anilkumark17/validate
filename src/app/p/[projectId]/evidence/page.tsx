"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageState } from "@/components/app-shell";
import { EvidenceForm } from "@/components/board/evidence-form";
import { ProjectHeader } from "@/components/project-nav";
import { Select } from "@/components/ui/form";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { useBoard, type EvidenceRow } from "@/lib/board/client";
import { INTERPRETATIONS } from "@/lib/board/constants";

export default function EvidencePage() {
  return (
    <RequireAuth>
      <Evidence />
    </RequireAuth>
  );
}

const STYLE = { supports: "text-positive", contradicts: "text-destructive", inconclusive: "text-muted-foreground" } as const;

function Evidence() {
  const { projectId } = useParams<{ projectId: string }>();
  const board = useBoard(projectId);
  const { data, isLoading, error } = useQuery({ queryKey: ["evidence", projectId], queryFn: () => api<EvidenceRow[]>(`/projects/${projectId}/evidence`) });
  const [filter, setFilter] = useState<"all" | (typeof INTERPRETATIONS)[number]>("all");
  const [assumptionId, setAssumptionId] = useState("");
  const rows = (data ?? []).filter((r) => filter === "all" || r.interpretation === filter);

  return (
    <>
      <main className="max-w-4xl">
        <ProjectHeader projectId={projectId} />
        <div className="space-y-6">
        <section className="space-y-3 rounded-lg border bg-card p-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Record evidence for</span>
            <Select value={assumptionId} onChange={(e) => setAssumptionId(e.target.value)}>
              <option value="">Choose an assumption…</option>
              {board.data?.assumptions.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </Select>
          </label>
          {assumptionId && <EvidenceForm key={assumptionId} projectId={projectId} assumptionId={assumptionId} stakeholders={board.data?.stakeholders ?? []} />}
        </section>
        <div className="flex items-center gap-3">
          <Select aria-label="Show evidence that" className="w-48" value={filter} onChange={(e) => setFilter(e.target.value as never)}>
            <option value="all">All evidence</option>
            {INTERPRETATIONS.map((i) => <option key={i} value={i}>{i[0]!.toUpperCase() + i.slice(1)}</option>)}
          </Select>
          <span className="num text-xs text-muted-foreground">{rows.length} record{rows.length === 1 ? "" : "s"}</span>
        </div>
        <PageState loading={isLoading} error={error?.message} empty={rows.length === 0 && !isLoading} emptyText="No evidence recorded yet. Pick an assumption above and add what you learned." />
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border bg-card empty:hidden">
          {rows.map((r) => (
            <li key={r.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className={`font-medium capitalize ${STYLE[r.interpretation]}`}>{r.interpretation}</span>
                <span className="capitalize">{r.type.replace("_", " ")}</span>
                <span className="capitalize">{r.strength}</span>
                <span className="num">{r.researchedOn}</span>
                {r.stakeholderRole && <span>{r.stakeholderRole}</span>}
              </div>
              <p className="mt-1.5 font-medium">{r.assumptionTitle}</p>
              {r.source && <p className="text-muted-foreground">{r.source}</p>}
              <p className="mt-1 whitespace-pre-wrap">{r.summary}</p>
              {r.reference && <p className="mt-1 break-all text-xs text-muted-foreground">Ref: {r.reference}</p>}
            </li>
          ))}
        </ul>
        </div>
      </main>
    </>
  );
}
