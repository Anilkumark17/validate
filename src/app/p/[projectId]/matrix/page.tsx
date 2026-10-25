"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Minus, ThumbsDown, ThumbsUp, Scale } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageState } from "@/components/app-shell";
import { ProjectHeader } from "@/components/project-nav";
import { Button } from "@/components/ui/button";
import { api, type Assumption, type Meeting } from "@/lib/api";
import { StatusBadge } from "@/lib/status-meta";
import { useProjectEvents } from "@/lib/use-project-events";

interface Matrix {
  assumptions: Assumption[];
  meetings: Meeting[];
  cells: Record<string, { net: number; supports: number; contradicts: number }>;
}
interface QItem {
  assumptionId: string;
  questions: string[];
}

function Cell({ c }: { c?: Matrix["cells"][string] }) {
  if (!c) return <span className="text-muted-foreground/50" aria-label="No coverage"><Minus className="mx-auto size-4" /></span>;
  const mixed = c.supports > 0 && c.contradicts > 0;
  const Icon = mixed ? Scale : c.net > 0 ? ThumbsUp : ThumbsDown;
  const cls = mixed
    ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    : c.net > 0
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  const label = mixed ? "Mixed" : c.net > 0 ? "Supports" : "Contradicts";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${cls}`} title={`${c.supports} supporting, ${c.contradicts} contradicting`}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
      {c.net > 0 ? `+${c.net}` : c.net}
    </span>
  );
}

export default function MatrixPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const key = ["matrix", projectId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<Matrix>(`/projects/${projectId}/matrix`) });
  const q = useQuery({
    queryKey: ["questions", projectId],
    queryFn: () => api<QItem[]>(`/projects/${projectId}/questions`),
    enabled: false,
    retry: false,
  });
  useProjectEvents(projectId, (ev) => {
    if (ev === "assumption.updated" || ev === "evidence.added") qc.invalidateQueries({ queryKey: key });
  });

  const covered = (a: Assumption) => data?.meetings.some((m) => data.cells[`${a.id}:${m.id}`]);
  const byId = new Map(data?.assumptions.map((a) => [a.id, a]));

  return (
    <>
      <ProjectHeader projectId={projectId} />
      <main className="mx-auto max-w-[1500px] space-y-10 px-4 py-6 sm:px-6">
        <PageState loading={isLoading} error={error?.message} empty={data?.assumptions.length === 0} emptyText="Add assumptions to see coverage." />
        {data && data.assumptions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Assumption coverage by meeting</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Assumption</th>
                  <th scope="col" className="px-2 py-3 font-medium">Status</th>
                  {data.meetings.map((m) => (
                    <th key={m.id} scope="col" className="max-w-[140px] px-2 py-3 text-center font-medium">
                      <Link href={m.state === "ended" ? `/m/${m.id}/review` : `/m/${m.id}/call`} className="line-clamp-2 hover:underline">
                        {m.title}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assumptions.map((a) => {
                  const gap = !covered(a);
                  return (
                    <tr key={a.id} className={`border-b last:border-0 ${gap ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}`}>
                      <th scope="row" className="max-w-md px-4 py-3 text-left font-normal">
                        <span className="flex items-start gap-2">
                          {gap && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Coverage gap" />}
                          {a.statement}
                        </span>
                      </th>
                      <td className="px-2 py-3"><StatusBadge status={a.status} /></td>
                      {data.meetings.map((m) => (
                        <td key={m.id} className="px-2 py-3 text-center"><Cell c={data.cells[`${a.id}:${m.id}`]} /></td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <section aria-labelledby="qs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="qs" className="text-lg font-semibold">Questions to ask next</h2>
              <p className="text-sm text-muted-foreground">Neutral, non-leading questions for untested and weak assumptions.</p>
            </div>
            <Button variant="outline" disabled={q.isFetching} onClick={() => q.refetch()}>
              {q.isFetching ? "Thinking…" : q.data ? "Refresh" : "Suggest questions"}
            </Button>
          </div>
          {q.error && <p className="text-sm text-destructive" role="alert">{(q.error as Error).message}</p>}
          {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Every assumption is well covered.</p>}
          <div className="grid gap-3 md:grid-cols-2">
            {q.data?.map((item) => (
              <div key={item.assumptionId} className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium">{byId.get(item.assumptionId)?.statement}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {item.questions.map((s) => <li key={s}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
