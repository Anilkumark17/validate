"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { STATUS_LABEL, type Status } from "@/lib/board/constants";
import { refreshBoard, type AssumptionDetail, type BoardAssumption } from "@/lib/board/client";
import { checkMove, isFinal, needsRationale } from "@/lib/board/transitions";

export interface MoveBody {
  from: Status;
  to: Status;
  rationale?: string;
  interpretation?: string;
  evidenceIds?: string[];
  confirm?: boolean;
}

export const moveRequest = (projectId: string, assumptionId: string, body: MoveBody) =>
  api<AssumptionDetail>(`/projects/${projectId}/assumptions/${assumptionId}/move`, { method: "POST", json: body });

/** True when the move needs the dialog (a decision or a written reason) instead of a plain drop. */
export const moveNeedsDialog = (from: Status, to: Status) => isFinal(to) || needsRationale(from, to);

const INTERP_STYLE = { supports: "text-positive", contradicts: "text-destructive", inconclusive: "text-muted-foreground" } as const;

export function MoveDialog({
  projectId,
  assumption,
  to,
  onClose,
}: {
  projectId: string;
  assumption: BoardAssumption;
  to: Status;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const from = assumption.status;
  const final = isFinal(to);
  const detail = useQuery({
    queryKey: ["assumption", projectId, assumption.id],
    queryFn: () => api<AssumptionDetail>(`/projects/${projectId}/assumptions/${assumption.id}`),
  });
  const evidence = detail.data?.evidence ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [rationale, setRationale] = useState("");
  const [confirm, setConfirm] = useState(false);

  const body: MoveBody = { from, to, rationale, interpretation, evidenceIds: final ? picked : undefined, confirm: final ? confirm : undefined };
  const local = checkMove(body, evidence);
  const save = useMutation({
    mutationFn: () => moveRequest(projectId, assumption.id, body),
    onSuccess: () => {
      toast.success(`Moved to ${STATUS_LABEL[to]}`);
      refreshBoard(qc, projectId);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={final ? `Record decision: ${STATUS_LABEL[to]}` : `Move to ${STATUS_LABEL[to]}`}
        description={assumption.title}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (local.ok) save.mutate();
          }}
        >
          {final && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Evidence this decision rests on</legend>
              {detail.isLoading && <p className="text-sm text-muted-foreground">Loading evidence…</p>}
              {!detail.isLoading && evidence.length === 0 && (
                <p className="rounded-md border border-warning/30 bg-warning-tint p-2 text-sm text-warning">
                  No evidence is recorded for this assumption yet. Record evidence first (Evidence tab of the assumption). A model explanation or a high confidence score is not evidence.
                </p>
              )}
              <ul className="space-y-1.5">
                {evidence.map((ev) => (
                  <li key={ev.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={picked.includes(ev.id)}
                        onChange={(e) => setPicked(e.target.checked ? [...picked, ev.id] : picked.filter((x) => x !== ev.id))}
                      />
                      <span>
                        <span className={`font-medium ${INTERP_STYLE[ev.interpretation]}`}>{ev.interpretation}</span> · {ev.type.replace("_", " ")} · {ev.strength} · {ev.researchedOn}
                        <span className="block text-muted-foreground">{ev.summary.slice(0, 160)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
          {final && (
            <div>
              <Label htmlFor="mv-interp">Your interpretation of the evidence</Label>
              <Textarea id="mv-interp" value={interpretation} onChange={(e) => setInterpretation(e.target.value)} rows={3} maxLength={2000} required />
            </div>
          )}
          <div>
            <Label htmlFor="mv-why">Decision rationale{needsRationale(from, to) ? "" : " (optional)"}</Label>
            <Textarea id="mv-why" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} maxLength={2000} required={needsRationale(from, to)} />
          </div>
          {final && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              <span>I confirm this decision. It is recorded in the decision history and cannot be edited.</span>
            </label>
          )}
          {!local.ok && (final || needsRationale(from, to)) && (rationale || interpretation || picked.length || confirm) && (
            <p className="text-sm text-destructive" role="status">
              {local.message}
              {local.recommend ? ` Consider moving it to ${STATUS_LABEL[local.recommend]} instead.` : ""}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!local.ok || save.isPending}>
              {save.isPending ? "Saving…" : final ? "Record decision" : "Move"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
