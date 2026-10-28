"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageState, TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { boardKey, isActive, refreshBoard, useBoard, type Run } from "@/lib/board/client";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  return (
    <RequireAuth>
      <Setup />
    </RequireAuth>
  );
}

interface AudienceResult {
  needsQuestion: boolean;
  suggestions?: string[];
  audience?: string | null;
  state?: string;
  warning?: string;
}

type StepState = "done" | "active" | "waiting" | "failed";

function Steps({ steps }: { steps: { label: string; note?: string; state: StepState }[] }) {
  return (
    <ol className="space-y-3" aria-label="Setup progress">
      {steps.map((s) => (
        <li key={s.label} className="flex items-start gap-3" aria-current={s.state === "active" ? "step" : undefined}>
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center" aria-hidden>
            {s.state === "done" ? (
              <Check className="size-4 text-chart" strokeWidth={2.5} />
            ) : s.state === "active" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : s.state === "failed" ? (
              <Circle className="size-3 fill-destructive text-destructive" />
            ) : (
              <Circle className="size-3 text-input" />
            )}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-sm", s.state === "waiting" ? "text-muted-foreground" : "font-medium")}>{s.label}</span>
            {s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * After creating a project: (1) one optional audience question, only if the idea does not name its
 * audience, (2) generation with a visible status, (3) redirect to the workspace. A failure keeps the
 * project and offers a retry.
 */
function Setup() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const board = useBoard(projectId);
  const [custom, setCustom] = useState("");
  const [answered, setAnswered] = useState(false);
  const startedFor = useRef<string | null>(null);

  const audience = useQuery({
    queryKey: ["audience", projectId],
    queryFn: () => api<AudienceResult>(`/projects/${projectId}/audience/analyze`, { method: "POST" }),
    retry: false,
    staleTime: Infinity,
    enabled: !!board.data && board.data.assumptions.length === 0 && !board.data.runs.initial,
  });

  const start = useMutation({
    mutationFn: () => api<{ run: Run }>(`/projects/${projectId}/generate`, { method: "POST", json: { idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => refreshBoard(qc, projectId),
    onError: (e: Error) => toast.error(e.message),
  });
  const answer = useMutation({
    mutationFn: (v: { state: "confirmed" | "skipped"; value?: string }) => api(`/projects/${projectId}/audience`, { method: "PUT", json: v }),
    onSuccess: () => {
      setAnswered(true);
      void qc.invalidateQueries({ queryKey: boardKey(projectId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = board.data;
  const run = data?.runs.initial ?? null;
  const needQuestion = !!audience.data?.needsQuestion && !answered && !run;
  const audienceSettled = audience.isFetched && !needQuestion;

  // Start generation once the audience question is settled. One start per page visit.
  useEffect(() => {
    if (!data || run || start.isPending || startedFor.current === projectId) return;
    if (data.assumptions.length > 0) return;
    if (audienceSettled || audience.isError) {
      startedFor.current = projectId;
      start.mutate();
    }
  }, [data, run, audienceSettled, audience.isError, projectId, start]);

  useEffect(() => {
    if (run?.status === "completed" || (data && data.assumptions.length > 0 && !isActive(run))) router.replace(`/p/${projectId}`);
  }, [run?.status, data, router, projectId, run]);

  if (board.isLoading || !data) {
    return (
      <>
        <TopBar />
        <main className="mx-auto w-full max-w-xl px-4 py-12">
          <PageState loading={board.isLoading} error={board.error?.message} />
        </main>
      </>
    );
  }

  const suggestions = audience.data?.suggestions ?? [];
  const reading = !run && audience.isLoading;
  const generating = isActive(run) || start.isPending;
  const steps: { label: string; note?: string; state: StepState }[] = [
    { label: "Read your idea", state: reading ? "active" : "done" },
    {
      label: "Confirm who it is for",
      note: needQuestion ? "One quick question below" : data.project.audienceState === "skipped" ? "Skipped, assumptions will be marked provisional" : undefined,
      state: reading ? "waiting" : needQuestion ? "active" : "done",
    },
    {
      label: "Draft assumptions and interview roles",
      note: generating ? "Usually under a minute" : undefined,
      state: run?.status === "failed" ? "failed" : generating ? "active" : "waiting",
    },
  ];

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight">{data.project.name}</h1>
        <p className="mb-8 mt-1 line-clamp-3 text-sm text-muted-foreground">{data.project.description}</p>

        <div className="rounded-lg border bg-card p-5">
          <Steps steps={steps} />
        </div>

        {needQuestion && (
          <section className="mt-4 space-y-4 rounded-lg border bg-card p-5" aria-labelledby="aud-q">
            <div>
              <h2 id="aud-q" className="text-base font-semibold">Who are you building this for?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Suggestions based on your idea, not facts about your market. Skip and the assumptions that depend on it are marked provisional.</p>
            </div>
            {audience.data?.warning && <p className="text-xs text-warning">{audience.data.warning}</p>}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Button key={s} variant="outline" size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ state: "confirmed", value: s })}>
                  {s}
                </Button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.trim().length >= 3) answer.mutate({ state: "confirmed", value: custom.trim() });
              }}
            >
              <div className="flex-1">
                <Label htmlFor="aud-custom">Something else</Label>
                <Input id="aud-custom" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={300} placeholder="Describe your audience" />
              </div>
              <Button type="submit" disabled={custom.trim().length < 3 || answer.isPending}>Use this</Button>
            </form>
            <Button variant="ghost" size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ state: "skipped" })}>
              Skip for now
            </Button>
          </section>
        )}

        {run?.status === "failed" && (
          <div className="mt-4 space-y-3 rounded-lg border border-destructive/40 bg-card p-5" role="alert">
            <p className="font-medium text-destructive">Generation failed</p>
            <p className="text-sm">{run.error}</p>
            <p className="text-sm text-muted-foreground">Your project is saved. Retrying will not create duplicates.</p>
            <div className="flex gap-2">
              <Button onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending ? "Starting…" : "Retry generation"}</Button>
              <Button variant="outline" onClick={() => router.push(`/p/${projectId}`)}>Open project anyway</Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
