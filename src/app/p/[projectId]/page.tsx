"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageState } from "@/components/app-shell";
import { RiskBadge, StatusBadge } from "@/components/board/badges";
import { GenerationNotice } from "@/components/board/generation-notice";
import { RefineDialog } from "@/components/board/refine-dialog";
import { ProjectHeader } from "@/components/project-nav";
import { EditProjectDialog } from "@/components/project-dialogs";
import { Button } from "@/components/ui/button";
import { api, type Project } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { refreshBoard, useBoard } from "@/lib/board/client";
import { MIN_INTERVIEWS_PER_STAKEHOLDER } from "@/lib/board/constants";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  return (
    <RequireAuth>
      <Overview />
    </RequireAuth>
  );
}

const AUDIENCE_NOTE = {
  unknown: "Assumptions that depend on it are provisional.",
  skipped: "You skipped this, so assumptions that depend on it are provisional.",
  detected: "Taken from your description.",
  confirmed: "Confirmed by you.",
} as const;

function Overview() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const { data, isLoading, error } = useBoard(projectId);
  const apply = useMutation({
    mutationFn: (c: { assumptionId: string; field: string; proposed: string }) => api(`/projects/${projectId}/assumptions/${c.assumptionId}`, { method: "PATCH", json: { [c.field]: c.proposed } }),
    onSuccess: () => {
      toast.success("Change applied");
      refreshBoard(qc, projectId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || error || !data) {
    return (
      <main className="max-w-5xl">
        <ProjectHeader projectId={projectId} title="Overview" description="What to test next, and how far along the project is." />
        <PageState loading={isLoading} error={error?.message} />
      </main>
    );
  }

  const p = data.progress;
  const open = data.assumptions.filter((a) => a.status !== "validated" && a.status !== "invalidated").sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0));
  const next = open[0];
  const queue = open.slice(1, 6);
  const roleOf = new Map(data.stakeholders.map((s) => [s.id, s.roleName]));
  const gaps = data.stakeholders.filter((s) => s.assumptionIds.length > 0 && s.interviewCount < MIN_INTERVIEWS_PER_STAKEHOLDER);
  const refine = data.runs.refine?.status === "completed" ? data.runs.refine : null;
  const tested = p.validated + p.invalidated;

  const ledger = [
    { label: "Validated", n: p.validated, bar: "bg-chart" },
    { label: "Invalidated", n: p.invalidated, bar: "bg-foreground" },
    { label: "In progress", n: p.inProgress + p.evidenceCollected + p.needsMoreEvidence, bar: "bg-input" },
    { label: "Not started", n: p.awaiting, bar: "bg-border" },
  ];

  return (
    <main className="max-w-6xl">
      <ProjectHeader
        projectId={projectId}
        title={data.project.name}
        description={
          <>
            <span className="line-clamp-2 whitespace-pre-wrap" title={data.project.description ?? undefined}>{data.project.description}</span>
            <span className="mt-1 block">
              Audience: <span className="text-foreground">{data.project.targetUser || "not set"}</span>. {AUDIENCE_NOTE[data.project.audienceState]}
            </span>
          </>
        }
      >
        <EditProjectDialog project={{ ...data.project, createdAt: "" } as Project} />
        <RefineDialog projectId={projectId} />
      </ProjectHeader>

      <div className="space-y-4">
        <GenerationNotice projectId={projectId} />

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
          <section aria-labelledby="next-h" className="rounded-lg border bg-card p-5">
            <p className="text-xs text-muted-foreground">Test next</p>
            {next ? (
              <>
                <h2 id="next-h" className="mt-1 text-lg font-semibold leading-6">{next.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <RiskBadge risk={next.risk} />
                  <StatusBadge status={next.status} />
                  {next.provisional && <span className="text-xs text-warning">Provisional: depends on an unconfirmed audience</span>}
                </div>
                {next.rationale && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{next.rationale}</p>}
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {next.validationMethod && (
                    <div>
                      <dt className="text-xs text-muted-foreground">How to test it</dt>
                      <dd className="mt-0.5 line-clamp-3">{next.validationMethod}</dd>
                    </div>
                  )}
                  {next.successCriteria && (
                    <div>
                      <dt className="text-xs text-muted-foreground">It holds if</dt>
                      <dd className="mt-0.5 line-clamp-3">{next.successCriteria}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-muted-foreground">Who to ask</dt>
                    <dd className="mt-0.5">{next.stakeholderIds.map((id) => roleOf.get(id)).filter(Boolean).join(", ") || "No role linked yet"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Evidence so far</dt>
                    <dd className="num mt-0.5">{next.evidenceCount === 0 ? "None" : next.evidenceCount}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/p/${projectId}/meetings`}>Plan an interview</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/p/${projectId}/evidence`}>Record evidence</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href={`/p/${projectId}/board`}>Open on board</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 id="next-h" className="mt-1 text-lg font-semibold">{p.total === 0 ? "No assumptions yet" : "Every assumption has a verdict"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.total === 0 ? "Generate them from your idea, or add one yourself on the board." : "Refine the project with new context to find what is still unproven."}
                </p>
              </>
            )}
          </section>
          <section aria-labelledby="queue-h" className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 id="queue-h" className="text-base font-semibold">Then these</h2>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/p/${projectId}/board`}>View all {open.length}</Link>
              </Button>
            </div>
            {queue.length === 0 ? (
              <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">{open.length === 0 ? "Nothing open." : "No other open assumptions."}</p>
            ) : (
              <ul className="mt-2 divide-y divide-rule pb-1">
                {queue.map((a) => (
                  <li key={a.id}>
                    <Link href={`/p/${projectId}/board`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/60">
                      <span className="w-24 shrink-0"><RiskBadge risk={a.risk} /></span>
                      <span className="min-w-0 flex-1 basis-60">{a.title}</span>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
          <div className="space-y-4 lg:col-span-4">
          <section aria-labelledby="ledger-h" className="rounded-lg border bg-card p-5">
            <h2 id="ledger-h" className="text-sm font-medium">Validation</h2>
            <p className="mt-3 text-3xl font-medium leading-9">
              <span className="num">{tested}</span> <span className="text-base text-muted-foreground">of <span className="num">{p.total}</span> tested</span>
            </p>
            <div
              className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-border"
              role="img"
              aria-label={ledger.map((l) => `${l.n} ${l.label.toLowerCase()}`).join(", ")}
            >
              {ledger.map((l) => (l.n > 0 ? <span key={l.label} className={cn("h-full", l.bar)} style={{ flexGrow: l.n }} /> : null))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {ledger.map((l) => (
                <li key={l.label} className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", l.bar)} aria-hidden />
                  <span className={l.n === 0 ? "text-muted-foreground" : undefined}>{l.label}</span>
                  <span className={cn("num ml-auto", l.n === 0 && "text-muted-foreground")}>{l.n}</span>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="-ml-3 mt-3" asChild>
              <Link href={`/p/${projectId}/decisions`}>See decision history</Link>
            </Button>
          </section>
          <section aria-labelledby="cov-h" className="rounded-lg border bg-card p-5">
            <h2 id="cov-h" className="text-base font-semibold">Interview coverage</h2>
            {gaps.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {data.stakeholders.length === 0 ? "Add stakeholder roles to see who still needs interviewing." : `Every role has at least ${MIN_INTERVIEWS_PER_STAKEHOLDER} interviews.`}
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {gaps.map((s) => (
                  <li key={s.id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{s.roleName}</span>
                      <span className="num shrink-0 text-xs text-muted-foreground">{s.interviewCount} of {MIN_INTERVIEWS_PER_STAKEHOLDER}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border" aria-hidden>
                      <div className="h-full bg-input" style={{ width: `${(s.interviewCount / MIN_INTERVIEWS_PER_STAKEHOLDER) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {gaps.length > 0 && (
              <Button size="sm" variant="outline" className="mt-4" asChild>
                <Link href={`/p/${projectId}/questions`}>Prepare questions</Link>
              </Button>
            )}
          </section>
          </div>
        </div>

        {refine?.result && (refine.result.suggestedChanges.length > 0 || refine.result.possiblyObsolete.length > 0 || refine.summary) && (
          <section aria-labelledby="ref-h" className="space-y-4 rounded-lg border bg-card p-5">
            <div>
              <h2 id="ref-h" className="text-base font-semibold">Last refinement</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Added {refine.result.created.assumptions} assumption{refine.result.created.assumptions === 1 ? "" : "s"} and {refine.result.created.stakeholders} role{refine.result.created.stakeholders === 1 ? "" : "s"}; skipped {refine.result.skipped.assumptions} duplicate{refine.result.skipped.assumptions === 1 ? "" : "s"}. {refine.summary}
              </p>
            </div>
            {refine.result.suggestedChanges.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">Suggested changes</h3>
                <p className="text-xs text-muted-foreground">Applied only when you confirm.</p>
                <ul className="mt-2 divide-y divide-rule rounded-md border">
                  {refine.result.suggestedChanges.map((c, i) => (
                    <li key={i} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                      <div className="min-w-0 flex-1 basis-64">
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.field}: {c.reason}</p>
                        <p className="mt-1">{c.proposed}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={apply.isPending} onClick={() => confirm(`Replace the ${c.field} of this assumption?`) && apply.mutate(c)}>Apply</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {refine.result.possiblyObsolete.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">Possibly obsolete</h3>
                <p className="text-xs text-muted-foreground">Nothing was changed. To retire one, move it to Invalidated on the board with a written rationale.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {refine.result.possiblyObsolete.map((o, i) => (
                    <li key={i}>{o.title}: {o.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
