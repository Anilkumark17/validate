"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { REFINE_DIMENSIONS, REFINE_LABEL } from "@/lib/board/schemas";
import { isActive, refreshBoard, useBoard, type Run } from "@/lib/board/client";

type Dim = (typeof REFINE_DIMENSIONS)[number];

/**
 * Refine Assumptions. Optional context dimensions; the result only ADDS new assumptions and roles.
 * Existing items, user edits, evidence, statuses and decisions are never overwritten.
 */
export function RefineDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Dim[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const { data } = useBoard(projectId);
  const busy = isActive(data?.runs.refine ?? null) || isActive(data?.runs.initial ?? null);
  const start = useMutation({
    mutationFn: () => api<{ run: Run }>(`/projects/${projectId}/refine`, { method: "POST", json: { idempotencyKey: crypto.randomUUID(), dimensions: picked, notes } }),
    onSuccess: () => {
      toast.success("Refining. New assumptions will appear on the board.");
      refreshBoard(qc, projectId);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={busy}>
          <Sparkles /> {busy ? "Generating…" : "Refine assumptions"}
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Refine assumptions"
        description="Pick what you know and add detail. Existing assumptions, edits, evidence and decisions stay untouched; new ones are added as Generated."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start.mutate();
          }}
        >
          <fieldset className="space-y-3">
            <legend className="sr-only">Context dimensions</legend>
            {REFINE_DIMENSIONS.map((d) => {
              const on = picked.includes(d);
              return (
                <div key={d}>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={on} onChange={(e) => setPicked(e.target.checked ? [...picked, d] : picked.filter((x) => x !== d))} />
                    {REFINE_LABEL[d]}
                  </label>
                  {on && (
                    <>
                      <Label htmlFor={`rf-${d}`} className="sr-only">{REFINE_LABEL[d]} details</Label>
                      <Textarea
                        id={`rf-${d}`}
                        className="mt-1.5"
                        rows={2}
                        maxLength={2000}
                        value={notes[d] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [d]: e.target.value })}
                        placeholder="What do you know or believe? Plain text."
                      />
                    </>
                  )}
                </div>
              );
            })}
          </fieldset>
          <div className="flex justify-end">
            <Button type="submit" disabled={start.isPending || picked.length === 0 || picked.every((d) => !(notes[d] ?? "").trim())}>
              {start.isPending ? "Starting…" : "Refine"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
