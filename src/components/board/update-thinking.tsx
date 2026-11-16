"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { refreshBoard, type BoardAssumption } from "@/lib/board/client";
import { toAssumptionFields, type RefinedAssumption, type UpdateTurn } from "@/lib/board/update-thinking";

type Turn = { role: "user" | "assistant"; content: string };

function fieldsOf(r: RefinedAssumption, stakeholderIds: string[]) {
  return { ...toAssumptionFields(r), stakeholderIds };
}

export function UpdateThinking({ projectId, assumption }: { projectId: string; assumption: BoardAssumption }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [newInput, setNewInput] = useState("");
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [turn, setTurn] = useState<UpdateTurn | null>(null);
  const [offerQuestions, setOfferQuestions] = useState(false);

  const ask = useMutation({
    mutationFn: (body: { newInput: string; conversation: Turn[] }) => api<UpdateTurn>(`/projects/${projectId}/assumptions/${assumption.id}/thinking`, { method: "POST", json: body }),
    onSuccess: (data, body) => {
      setTurn(data);
      setNewInput(body.newInput);
      setConversation(body.conversation);
      setAnswer("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: async (done: Extract<UpdateTurn, { done: true }>) => {
      await api(`/projects/${projectId}/assumptions/${assumption.id}`, { method: "PATCH", json: toAssumptionFields(done.refined) });
      const failed: string[] = [];
      for (const extra of done.split_into) {
        try {
          await api(`/projects/${projectId}/assumptions`, { method: "POST", json: fieldsOf(extra, assumption.stakeholderIds) });
        } catch (e) {
          failed.push(e instanceof Error ? e.message : extra.title);
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      toast.success("Assumption updated. Status and evidence were left as they were.");
      if (failed.length) toast.error(failed.join(" "));
      refreshBoard(qc, projectId);
      setOfferQuestions(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: () => api(`/projects/${projectId}/context`, { method: "POST", json: { title: `Note on: ${assumption.title}`.slice(0, 120), content: newInput } }),
    onSuccess: () => toast.success("Added to project context"),
    onError: (e: Error) => toast.error(e.message),
  });

  const align = useMutation({
    mutationFn: () => api<{ questions: string[]; guidesRewritten: number }>(`/projects/${projectId}/assumptions/${assumption.id}/questions`, { method: "POST" }),
    onSuccess: (r) => {
      toast.success(r.guidesRewritten ? `Questions updated, and ${r.guidesRewritten} interview guide${r.guidesRewritten === 1 ? "" : "s"} rewritten.` : "Questions updated to match this assumption.");
      refreshBoard(qc, projectId);
      void qc.invalidateQueries({ queryKey: ["guides", projectId] });
      void qc.invalidateQueries({ queryKey: ["assumption", projectId, assumption.id] });
      setOfferQuestions(false);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Update with new thinking
      </Button>
    );
  }

  const start = () => {
    const text = draft.trim();
    if (!text) return;
    ask.mutate({ newInput: text, conversation: [] });
  };

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="Update this assumption">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">Update with new thinking</h3>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <p className="text-xs text-muted-foreground">A thought is folded in. Something a person said is recorded as evidence, not used to rewrite the assumption. Nothing is saved until you apply it.</p>

      {!turn && (
        <div>
          <Label htmlFor="new-thinking">What changed in your thinking?</Label>
          <Textarea id="new-thinking" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={4000} placeholder="A belief, a change of scope, or a note. Not a quote from an interview." />
          <div className="mt-2 flex justify-end">
            <Button onClick={start} disabled={ask.isPending || draft.trim().length === 0}>{ask.isPending ? "Reading…" : "Continue"}</Button>
          </div>
        </div>
      )}

      {turn && "route" in turn && (
        <div className="space-y-2 text-sm">
          <p>{turn.message}</p>
          {turn.route === "note" && (
            <Button variant="outline" onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>{saveNote.isPending ? "Saving…" : "Add this note to project context"}</Button>
          )}
          {turn.route === "evidence" && <p className="text-xs text-muted-foreground">Use the Evidence tab. The assumption itself stays as it is.</p>}
        </div>
      )}

      {turn && "done" in turn && !turn.done && (
        <div className="space-y-2 text-sm">
          <p className="border-l-2 border-border pl-3 text-muted-foreground">“{turn.quoted}”</p>
          <p>{turn.question}</p>
          <p className="text-xs text-muted-foreground">{turn.why}</p>
          <Label htmlFor="thinking-answer">Your answer</Label>
          <Textarea id="thinking-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} maxLength={2000} />
          <div className="flex justify-end">
            <Button
              disabled={ask.isPending || answer.trim().length === 0}
              onClick={() =>
                ask.mutate({
                  newInput,
                  conversation: [...conversation, { role: "assistant", content: turn.question }, { role: "user", content: answer.trim() }],
                })
              }
            >
              {ask.isPending ? "Reading…" : `Answer (${turn.asked} of 3)`}
            </Button>
          </div>
        </div>
      )}

      {turn && "done" in turn && turn.done && !offerQuestions && (
        <div className="space-y-3 text-sm">
          <p className="font-medium">{turn.refined.title}</p>
          <p className="whitespace-pre-wrap">{turn.refined.statement}</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {turn.changes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {turn.split_into.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Also create</p>
              <ul className="list-disc pl-5">
                {turn.split_into.map((s) => (
                  <li key={s.title}>{s.title}</li>
                ))}
              </ul>
            </div>
          )}
          {turn.unresolved_gaps.length > 0 && <p className="text-xs text-muted-foreground">Still open: {turn.unresolved_gaps.join(", ")}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setTurn(null); setConversation([]); }}>Start over</Button>
            <Button onClick={() => apply.mutate(turn)} disabled={apply.isPending}>{apply.isPending ? "Saving…" : "Apply this wording"}</Button>
          </div>
        </div>
      )}

      {offerQuestions && (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm" role="dialog" aria-label="Regenerate questions">
          <p className="font-medium">This assumption changed.</p>
          <p className="text-muted-foreground">Regenerate its questions so they ask about the new wording? Interview guides that test this assumption are rewritten too.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOfferQuestions(false); setOpen(false); }}>Keep the old questions</Button>
            <Button onClick={() => align.mutate()} disabled={align.isPending}>{align.isPending ? "Rewriting…" : "Regenerate questions"}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
