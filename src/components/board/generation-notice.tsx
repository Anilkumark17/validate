"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { isActive, refreshBoard, useBoard, type Run } from "@/lib/board/client";

export function RetryGeneration({ projectId, label = "Retry generation" }: { projectId: string; label?: string }) {
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: () => api(`/projects/${projectId}/generate`, { method: "POST", json: { idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => refreshBoard(qc, projectId),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="outline" onClick={() => retry.mutate()} disabled={retry.isPending}>
      <RotateCw /> {retry.isPending ? "Starting…" : label}
    </Button>
  );
}

/** Shows an active run, a failed run with a retry, or nothing. The project is never lost on failure. */
export function GenerationNotice({ projectId }: { projectId: string }) {
  const { data } = useBoard(projectId);
  if (!data) return null;
  const { initial, refine } = data.runs;
  const run: Run | null = isActive(refine) ? refine : initial;
  if (isActive(run)) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {run!.kind === "refine" ? "Refining assumptions with the new context…" : "Generating assumptions and stakeholder roles. This usually takes up to a minute."}
      </div>
    );
  }
  if (initial?.status === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">
        <span className="min-w-0 flex-1 text-destructive">Generation failed: {initial.error ?? "unknown error"}. Your project is saved.</span>
        <RetryGeneration projectId={projectId} />
      </div>
    );
  }
  if (!initial && data.assumptions.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <span className="flex-1">No assumptions yet.</span>
        <RetryGeneration projectId={projectId} label="Generate assumptions" />
      </div>
    );
  }
  if (refine?.status === "failed") {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">Refinement failed: {refine.error}. Nothing was changed; open Refine assumptions to try again.</div>;
  }
  return null;
}
