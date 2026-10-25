"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export interface MappedAssumption {
  id: string;
  statement: string;
  type: "desirability" | "feasibility" | "viability";
  category: string;
  origin: "stated" | "implicit";
  importance: number;
  evidence: string;
  evidenceNote?: string;
  risk: number;
  dependsOn: string[];
  falsifiedIf: string;
  leapOfFaith: boolean;
  test?: { method: string; who: string; action: string; passSignal: string; failSignal: string; effort: string };
}
export interface IdeaMapResult {
  ideaCard: Record<string, unknown>;
  clarifyingQuestions: string[];
  assumptions: MappedAssumption[];
  testSequence: string[];
  blindSpots: string[];
  claimsToVerify: string[];
}

export function MapResults({ projectId, result, compact = false, onSaved }: { projectId: string; result: IdeaMapResult; compact?: boolean; onSaved?: () => void }) {
  const qc = useQueryClient();
  const sorted = [...result.assumptions].sort((a, b) => Number(b.leapOfFaith) - Number(a.leapOfFaith) || b.risk - a.risk);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(sorted.filter((a) => a.leapOfFaith || a.risk >= 4).map((a) => a.id)));
  const save = useMutation({
    mutationFn: () => {
      const items = sorted
        .filter((a) => picked.has(a.id))
        .map((a) => ({
          statement: a.statement.slice(0, 500),
          type: a.type,
          risk: a.risk,
          meta: {
            category: a.category,
            origin: a.origin,
            importance: a.importance,
            evidence: a.evidence,
            evidenceNote: a.evidenceNote,
            falsifiedIf: a.falsifiedIf,
            leapOfFaith: a.leapOfFaith,
            test: a.test,
          },
        }));
      return api(`/projects/${projectId}/assumptions`, { method: "POST", json: items });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assumptions", projectId] });
      toast.success(`Added ${picked.size} assumptions to the board`);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!compact && result.clarifyingQuestions.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Answer these to sharpen the map:</p>
          <ul className="list-disc pl-5">{result.clarifyingQuestions.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      )}
      <ul className="space-y-2">
        {sorted.map((a) => (
          <li key={a.id} className="rounded-lg border bg-card p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--primary)]"
                checked={picked.has(a.id)}
                onChange={(e) =>
                  setPicked((s) => {
                    const n = new Set(s);
                    e.target.checked ? n.add(a.id) : n.delete(a.id);
                    return n;
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{a.statement}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {a.leapOfFaith && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      <Star className="size-3" aria-hidden /> Leap of faith
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5">{a.type}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">{a.origin}</span>
                  <span className="text-muted-foreground">Risk {a.risk}/5 · evidence {a.evidence}</span>
                </span>
              </span>
            </label>
            {!compact && (
              <div className="ml-7 mt-2 space-y-1 text-xs text-muted-foreground">
                <p>False if: {a.falsifiedIf}</p>
                {a.evidenceNote && <p>Evidence note: {a.evidenceNote}</p>}
                {a.test && (
                  <p className="flex gap-1.5 text-foreground">
                    <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                      <b>{a.test.method.replace(/_/g, " ")}</b> ({a.test.effort}): {a.test.action} Pass: {a.test.passSignal} Fail: {a.test.failSignal}
                    </span>
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {!compact && result.blindSpots.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blind spots</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{result.blindSpots.map((b) => <li key={b}>{b}</li>)}</ul>
        </section>
      )}
      {!compact && result.claimsToVerify.length > 0 && (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Claims to verify</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{result.claimsToVerify.map((b) => <li key={b}>{b}</li>)}</ul>
        </section>
      )}
      <Button disabled={picked.size === 0 || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Adding…" : `Add ${picked.size} to board`}
      </Button>
    </div>
  );
}
