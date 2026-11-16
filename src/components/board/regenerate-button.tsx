"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCw, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { isActive, refreshBoard, useBoard } from "@/lib/board/client";

/** Rebuilds assumptions, stakeholder roles, personas and interview guides from the project idea and context. */
export function RegenerateButton({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const board = useBoard(projectId);
  const run = board.data?.runs.initial ?? null;
  const running = isActive(run);

  const stop = useMutation({
    mutationFn: () => api(`/projects/${projectId}/generation/stop`, { method: "POST" }),
    onSuccess: () => refreshBoard(qc, projectId),
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: () => api(`/projects/${projectId}/regenerate`, { method: "POST", json: { idempotencyKey: crypto.randomUUID() } }),
    onSuccess: () => {
      refreshBoard(qc, projectId);
      void qc.invalidateQueries({ queryKey: ["personas", projectId] });
      void qc.invalidateQueries({ queryKey: ["guides", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // When a run finishes, reload what it wrote.
  const was = useRef(running);
  useEffect(() => {
    if (was.current && !running) {
      void qc.invalidateQueries({ queryKey: ["personas", projectId] });
      void qc.invalidateQueries({ queryKey: ["guides", projectId] });
      if (run?.status === "completed") {
        const x = run.result?.extras;
        toast.success(x?.failed?.length ? `Regenerated. Not made: ${x.failed.join(", ")}.` : "Regenerated");
      } else if (run?.status === "failed" && run.error !== "Stopped") toast.error(run.error ?? "Regeneration failed");
      else if (run?.status === "failed") toast("Generation stopped. Nothing further was saved.");
    }
    was.current = running;
  }, [running, run, qc, projectId]);

  return (
    <Button
      variant={running ? "destructive" : "outline"}
      disabled={start.isPending || stop.isPending}
      onClick={() => {
        if (running) {
          stop.mutate();
          return;
        }
        if (confirm("Regenerate from the project idea and context?\n\nUntouched AI assumptions, roles, persona drafts and interview guides are replaced. Anything you wrote, any assumption with evidence or decisions, and approved personas are kept.")) {
          start.mutate();
        }
      }}
    >
      {running ? <Square /> : <RotateCw />} {running ? "Stop" : start.isPending ? "Starting…" : "Regenerate"}
    </Button>
  );
}
