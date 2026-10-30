"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
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
        toast.success(x?.failed.length ? `Regenerated. Not made: ${x.failed.join(", ")}.` : "Regenerated");
      } else if (run?.status === "failed") toast.error(run.error ?? "Regeneration failed");
    }
    was.current = running;
  }, [running, run, qc, projectId]);

  return (
    <Button
      variant="outline"
      disabled={start.isPending || running}
      onClick={() => {
        if (confirm("Regenerate from the project idea and context?\n\nUntouched AI assumptions, roles, persona drafts and interview guides are replaced. Anything you wrote, any assumption with evidence or decisions, and approved personas are kept.")) {
          start.mutate();
        }
      }}
    >
      <RotateCw className={running ? "animate-spin" : undefined} /> {running ? "Regenerating…" : start.isPending ? "Starting…" : "Regenerate"}
    </Button>
  );
}
