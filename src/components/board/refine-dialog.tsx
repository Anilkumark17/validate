"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { isActive, refreshBoard, useBoard, type Run } from "@/lib/board/client";
import { type RefineCheck } from "@/lib/board/refine-check";
import { REFINE_DIMENSIONS, REFINE_LABEL } from "@/lib/board/schemas";

type Dim = (typeof REFINE_DIMENSIONS)[number];
type Turn = { role: "user" | "assistant"; content: string };
type CheckBody = { learning: string; dimensions: Dim[]; conversation: Turn[] };

function pairs(conversation: Turn[]) {
  const answers: { question: string; answer: string }[] = [];
  for (let i = 0; i < conversation.length - 1; i++) {
    const q = conversation[i];
    const a = conversation[i + 1];
    if (q?.role === "assistant" && a?.role === "user") answers.push({ question: q.content, answer: a.content });
  }
  return answers.slice(0, 2);
}

/**
 * Refine Assumptions. One optional learning note plus aspect checkboxes.
 * A gap check may ask two questions. The run only ADDS new assumptions and roles.
 */
export function RefineDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [learning, setLearning] = useState("");
  const [picked, setPicked] = useState<Dim[]>([]);
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [turn, setTurn] = useState<Extract<RefineCheck, { done: false }> | null>(null);
  const [answer, setAnswer] = useState("");
  const qc = useQueryClient();
  const { data } = useBoard(projectId);
  const busy = isActive(data?.runs.refine ?? null) || isActive(data?.runs.initial ?? null);
  const ready = learning.trim().length > 0 || picked.length > 0;

  function reset() {
    setLearning("");
    setPicked([]);
    setConversation([]);
    setTurn(null);
    setAnswer("");
  }

  const start = useMutation({
    mutationFn: (body: { learning: string; dimensions: Dim[]; answers: { question: string; answer: string }[] }) =>
      api<{ run: Run }>(`/projects/${projectId}/refine`, { method: "POST", json: { idempotencyKey: crypto.randomUUID(), ...body } }),
    onSuccess: () => {
      toast.success("Refining. New assumptions will appear on the board.");
      refreshBoard(qc, projectId);
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function generate(body: CheckBody) {
    start.mutate({ learning: body.learning, dimensions: body.dimensions, answers: pairs(body.conversation) });
  }

  const check = useMutation({
    mutationFn: (body: CheckBody) => api<RefineCheck>(`/projects/${projectId}/refine/check`, { method: "POST", json: body }),
    onSuccess: (data, body) => {
      if (data.done) {
        generate(body);
        return;
      }
      setConversation(body.conversation);
      setTurn(data);
      setAnswer("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reply(text: string) {
    if (!turn || check.isPending || start.isPending) return;
    const next: Turn[] = [...conversation, { role: "assistant", content: turn.question }, { role: "user", content: text }];
    const body = { learning, dimensions: picked, conversation: next };
    if (next.filter((t) => t.role === "assistant").length >= 2) generate(body);
    else check.mutate(body);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={busy}>
          <Sparkles /> {busy ? "Generating…" : "Refine assumptions"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-xl"
        title="Refine assumptions"
        description="Write what you want to learn and select the aspects to cover. Existing assumptions, edits, evidence and decisions stay untouched. New ones are added as Generated."
      >
        {turn ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Question {turn.asked} of 2. This checks the note against the idea. It does not change an assumption.</p>
            <blockquote className="border-l-2 pl-3 text-sm">“{turn.quoted}”</blockquote>
            <p className="text-sm">{turn.why}</p>
            <p className="text-sm font-medium">{turn.question}</p>
            <div>
              <Label htmlFor="refine-answer">Your answer</Label>
              <Textarea id="refine-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={2000} rows={3} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => reply("I don't know")} disabled={check.isPending || start.isPending}>I don't know</Button>
              <Button onClick={() => reply(answer.trim())} disabled={answer.trim().length < 1 || check.isPending || start.isPending}>
                {check.isPending || start.isPending ? "Working…" : "Answer"}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ready || check.isPending || start.isPending) return;
              check.mutate({ learning, dimensions: picked, conversation: [] });
            }}
          >
            <div>
              <Label htmlFor="refine-learning">What do you want to learn?</Label>
              <Textarea
                id="refine-learning"
                value={learning}
                onChange={(e) => setLearning(e.target.value)}
                maxLength={4000}
                rows={5}
                className="min-h-28"
                placeholder="Optional. What you want the new assumptions to cover."
              />
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Aspects</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {REFINE_DIMENSIONS.map((d) => {
                  const on = picked.includes(d);
                  return (
                    <label key={d} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded-sm border border-input"
                        checked={on}
                        onChange={() => setPicked(on ? picked.filter((x) => x !== d) : [...picked, d])}
                      />
                      {REFINE_LABEL[d]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" disabled={!ready || start.isPending || check.isPending} onClick={() => generate({ learning, dimensions: picked, conversation: [] })}>
                {start.isPending ? "Starting…" : "Generate now"}
              </Button>
              <Button type="submit" disabled={!ready || start.isPending || check.isPending}>
                {check.isPending ? "Checking…" : "Check and refine"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
