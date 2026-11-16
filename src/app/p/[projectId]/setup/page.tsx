"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageState, TopBar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { RequireAuth } from "@/lib/auth";
import { boardKey, isActive, refreshBoard, useBoard, type Run } from "@/lib/board/client";
import { SETUP_ASPECTS, SETUP_ASPECT_LABEL } from "@/lib/board/schemas";
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
 * audience, (2) a note and the aspects the assumptions should cover, (3) generation with a visible
 * status, (4) redirect to the workspace. A failure keeps the project and offers a retry.
 */
function Setup() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const board = useBoard(projectId);
  const [custom, setCustom] = useState("");
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [own, setOwn] = useState("");

  const audience = useQuery({
    queryKey: ["audience", projectId],
    queryFn: () => api<AudienceResult>(`/projects/${projectId}/audience/analyze`, { method: "POST" }),
    retry: false,
    staleTime: Infinity,
    enabled:
      !!board.data &&
      board.data.assumptions.length === 0 &&
      board.data.project.audienceState === "unknown" &&
      board.data.runs.initial?.status !== "completed" &&
      board.data.runs.initial?.status !== "pending" &&
      board.data.runs.initial?.status !== "running",
  });

  const start = useMutation({
    mutationFn: (body: { aspects: string[]; note: string }) =>
      api<{ run: Run }>(`/projects/${projectId}/generate`, { method: "POST", json: { idempotencyKey: crypto.randomUUID(), aspects: body.aspects, note: body.note } }),
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
  const needQuestion = !!audience.data?.needsQuestion && !answered && !isActive(run);

  function begin(aspects: string[], text: string, includeDraft = false) {
    if (start.isPending) return;
    const extra = includeDraft ? own.trim() : "";
    const withOwn = extra.length >= 2 && !aspects.includes(extra) ? [...aspects, extra] : aspects;
    start.mutate({ aspects: withOwn.slice(0, 8), note: text });
  }

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
      label: "Say what the assumptions should cover",
      note: !run && !needQuestion && !reading ? "Pick aspects, or skip" : undefined,
      state: reading || needQuestion ? "waiting" : run || generating ? "done" : "active",
    },
    {
      label: "Draft assumptions and interview roles",
      note: generating ? "Usually under a minute" : undefined,
      state: run?.status === "failed" ? "failed" : generating ? "active" : "waiting",
    },
  ];
  const showAspects = !run && !needQuestion && !reading && !generating;
  const preset = new Set<string>(SETUP_ASPECTS);
  const aspectItems = [
    ...SETUP_ASPECTS.map((id) => ({ id, label: SETUP_ASPECT_LABEL[id] })),
    ...picked.filter((id) => !preset.has(id)).map((id) => ({ id, label: id })),
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

        {showAspects && (
          <section className="mt-4 space-y-5 rounded-lg border bg-card p-5" aria-labelledby="focus-q">
            <div>
              <h2 id="focus-q" className="text-base font-semibold">What should the assumptions cover?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Write what you already know, then select the parts of people’s behavior you want tested. Add your own if none of these fit. This is used to draft assumptions. It is not evidence.</p>
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} rows={6} className="min-h-36" placeholder="What you already know about the people, the flow, or how you would test it" aria-label="What you already know" />
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Aspects</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {aspectItems.map((item) => {
                  const on = picked.includes(item.id);
                  return (
                    <label key={item.id} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border border-input"
                        checked={on}
                        onChange={() => setPicked(on ? picked.filter((x) => x !== item.id) : [...picked, item.id])}
                      />
                      {item.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const label = own.trim();
                if (label.length < 2 || picked.includes(label)) return;
                setPicked([...picked, label]);
                setOwn("");
              }}
            >
              <div className="flex-1">
                <Label htmlFor="own-aspect">Add your own</Label>
                <Input id="own-aspect" value={own} onChange={(e) => setOwn(e.target.value)} maxLength={40} placeholder="For example, who pays" />
              </div>
              <Button type="submit" variant="outline" disabled={own.trim().length < 2 || picked.length >= 8}>Add</Button>
            </form>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => begin([], "")} disabled={start.isPending}>Skip</Button>
              <Button onClick={() => begin(picked, note, true)} disabled={start.isPending}>{start.isPending ? "Starting…" : "Generate assumptions"}</Button>
            </div>
          </section>
        )}

        {run?.status === "failed" && (
          <div className="mt-4 space-y-3 rounded-lg border border-destructive/40 bg-card p-5" role="alert">
            <p className="font-medium text-destructive">Generation failed</p>
            <p className="text-sm">{run.error}</p>
            <p className="text-sm text-muted-foreground">Your project is saved. Retrying will not create duplicates.</p>
            <div className="flex gap-2">
              <Button onClick={() => begin([], "")} disabled={start.isPending}>{start.isPending ? "Starting…" : "Retry generation"}</Button>
              <Button variant="outline" onClick={() => router.push(`/p/${projectId}`)}>Open project anyway</Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
