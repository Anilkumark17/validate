"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search, Square, Wand2 } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { PageState, Skeleton } from "@/components/app-shell";
import { RiskBadge } from "@/components/board/badges";
import { RegenerateButton } from "@/components/board/regenerate-button";
import { ProjectHeader } from "@/components/project-nav";
import { Guide, GuideView, useAsked } from "@/components/questions/guide-view";
import { QuestionRow } from "@/components/questions/question-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { refreshBoard, useBoard, type BoardAssumption } from "@/lib/board/client";
import { cn } from "@/lib/utils";

export default function QuestionsPage() {
  return (
    <RequireAuth>
      <Suspense>
        <Questions />
      </Suspense>
    </RequireAuth>
  );
}

function AssumptionQuestions({ projectId, assumption }: { projectId: string; assumption: BoardAssumption }) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const stopRef = useRef<AbortController | null>(null);

  function toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (running) {
      stopRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    stopRef.current = controller;
    setRunning(true);
    api<{ stopped?: boolean; guidesRewritten: number }>(`/projects/${projectId}/assumptions/${assumption.id}/questions`, { method: "POST", signal: controller.signal })
      .then((r) => {
        if (r.stopped) toast("Stopped. These questions were left as they are.");
        else toast.success(r.guidesRewritten ? `Questions updated, and ${r.guidesRewritten} interview guide${r.guidesRewritten === 1 ? "" : "s"} rewritten.` : "Questions updated to match this assumption.");
        refreshBoard(qc, projectId);
        void qc.invalidateQueries({ queryKey: ["guides", projectId] });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) toast("Stopped. These questions were left as they are.");
        else toast.error(e instanceof Error ? e.message : "Could not update the questions");
      })
      .finally(() => {
        stopRef.current = null;
        setRunning(false);
      });
  }

  return (
    <Button size="sm" variant={running ? "destructive" : "outline"} onClick={toggle}>
      {running ? <Square /> : <Wand2 />} {running ? "Stop" : "Update"}
    </Button>
  );
}

function Questions() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const board = useBoard(projectId);
  const initialRole = useSearchParams().get("role");
  const [roleId, setRoleId] = useState<string | null>(initialRole);
  const [q, setQ] = useState("");
  const guides = useQuery({ queryKey: ["guides", projectId], queryFn: () => api<Guide[]>(`/projects/${projectId}/guides`) });

  const roles = board.data?.stakeholders ?? [];
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  const guide = guides.data?.filter((g) => g.stakeholderId === role?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const quick = useAsked(`role-${role?.id ?? "none"}`);

  const make = useMutation({
    mutationFn: (stakeholderId: string) => api<Guide>(`/projects/${projectId}/guides`, { method: "POST", json: { stakeholderId } }),
    onSuccess: () => {
      toast.success("Interview guide ready");
      void qc.invalidateQueries({ queryKey: ["guides", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/projects/${projectId}/guides/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guides", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const titleOf = new Map((board.data?.assumptions ?? []).map((a) => [a.id, a.title]));
  const withQuestions = (board.data?.assumptions ?? [])
    .filter((a) => a.validationQuestions.length > 0)
    .filter((a) => a.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (b.risk ?? 0) - (a.risk ?? 0));
  const guideFor = new Set((guides.data ?? []).map((g) => g.stakeholderId));

  return (
    <main className="max-w-4xl">
      <ProjectHeader projectId={projectId}>
        <RegenerateButton projectId={projectId} />
      </ProjectHeader>
      <Tabs defaultValue="guides">
        <TabsList className="mb-5" aria-label="Question views">
          <TabsTrigger value="guides" className="flex-none px-4">Interview guides</TabsTrigger>
          <TabsTrigger value="assumptions" className="flex-none px-4">
            By assumption <span className="num ml-1 text-xs font-normal text-muted-foreground">{board.data ? board.data.assumptions.filter((a) => a.validationQuestions.length > 0).length : ""}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guides">
          <PageState loading={board.isLoading} error={board.error?.message} />
          {board.data && roles.length === 0 && (
            <div className="rounded-lg border border-dashed bg-card px-6 py-8 text-center">
              <p className="font-medium">Add a stakeholder role first</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">A guide is written for one role, such as the people you will interview.</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={`/p/${projectId}/stakeholders`}>Go to stakeholders</Link>
              </Button>
            </div>
          )}

          {role && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Interviewing</p>
                <div role="group" aria-label="Choose who you are interviewing" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {roles.map((r) => {
                    const on = r.id === role.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={on}
                        title={r.roleName}
                        onClick={() => setRoleId(r.id)}
                        className={cn(
                          "inline-flex h-8 max-w-64 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm",
                          on ? "border-transparent bg-border font-medium" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{r.roleName}</span>
                        {guideFor.has(r.id) && <Check className="size-3.5 shrink-0 text-chart" strokeWidth={2.5} aria-label="Has a guide" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {guide ? (
                <GuideView
                  key={guide.id}
                  guide={guide}
                  roleName={role.roleName}
                  titleOf={titleOf}
                  projectId={projectId}
                  deleting={remove.isPending}
                  onDelete={() => remove.mutate(guide.id)}
                />
              ) : (
                <section className="rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4">
                    <div className="min-w-0 flex-1 basis-56">
                      <h2 className="text-base font-semibold">Start with these</h2>
                      <p className="text-sm text-muted-foreground">
                        <span className="num">{role.interviewQuestions.length}</span> questions for this role. A full guide adds five acts and follow-ups.
                      </p>
                    </div>
                    <Button disabled={role.assumptionIds.length === 0 || make.isPending} onClick={() => make.mutate(role.id)}>
                      {make.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />} {make.isPending ? "Writing the guide" : "Create full guide"}
                    </Button>
                  </div>
                  {role.assumptionIds.length === 0 && (
                    <p className="border-b px-5 py-2.5 text-xs text-muted-foreground">
                      Link an assumption to this role to enable the full guide.{" "}
                      <Link href={`/p/${projectId}/stakeholders`} className="underline underline-offset-2">Edit role</Link>
                    </p>
                  )}
                  {make.isPending && (
                    <div className="space-y-2 border-b px-5 py-4" role="status">
                      <p className="text-sm text-muted-foreground">Five acts, usually under a minute. You can use the questions below meanwhile.</p>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  )}
                  {role.interviewQuestions.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">No quick questions yet. Create the full guide, or edit the role to add some.</p>
                  ) : (
                    <ul className="divide-y divide-rule px-5">
                      {role.interviewQuestions.map((text) => (
                        <QuestionRow key={text} text={text} asked={quick.asked.has(text)} onToggle={() => quick.toggle(text)} />
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assumptions">
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search assumptions" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assumptions" />
          </div>
          {board.data && withQuestions.length === 0 && (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {q ? "No assumption matches." : "No assumption has questions yet. Generated assumptions come with them."}
            </p>
          )}
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border bg-card empty:hidden">
            {withQuestions.map((a) => (
              <li key={a.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3.5 hover:bg-muted/60">
                    <span className="w-24 shrink-0"><RiskBadge risk={a.risk} /></span>
                    <span className="min-w-0 flex-1">{a.title}</span>
                    <AssumptionQuestions projectId={projectId} assumption={a} />
                    <span className="num shrink-0 text-xs text-muted-foreground">{a.validationQuestions.length}</span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  {a.description && <p className="border-t px-5 py-3 text-sm text-muted-foreground">{a.description}</p>}
                  <ul className="divide-y divide-rule border-t bg-muted/40 px-5 pl-[calc(1.25rem+6rem+1rem)] max-md:pl-5">
                    {a.validationQuestions.map((text) => (
                      <QuestionRow key={text} text={text} />
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </main>
  );
}
