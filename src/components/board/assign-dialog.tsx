"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { type AssignProposal } from "@/lib/board/assign";
import { refreshBoard, type BoardAssumption, type BoardStakeholder } from "@/lib/board/client";

/** Suggested links. Nothing is written until the person applies a selection. */
export function AssignDialog({ projectId, assumptions, stakeholders }: { projectId: string; assumptions: BoardAssumption[]; stakeholders: BoardStakeholder[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [proposal, setProposal] = useState<AssignProposal | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const titles = new Map(assumptions.map((a) => [a.id, a.title]));
  const roles = new Map(stakeholders.map((s) => [s.id, s.roleName]));

  const propose = useMutation({
    mutationFn: () => api<AssignProposal>(`/projects/${projectId}/assign`, { method: "POST" }),
    onSuccess: (data) => {
      setProposal(data);
      setPicked(new Set(data.links.filter((l) => l.action !== "remove_existing").map((l) => l.assumption_id)));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: (updates: { assumptionId: string; stakeholderIds: string[] }[]) => api(`/projects/${projectId}/assign/apply`, { method: "POST", json: { updates } }),
    onSuccess: () => {
      toast.success("Stakeholder links updated. Assumptions, status and evidence were left as they were.");
      refreshBoard(qc, projectId);
      setOpen(false);
      setProposal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function confirm() {
    if (!proposal) return;
    const updates = [
      ...proposal.links.filter((l) => picked.has(l.assumption_id)).map((l) => ({ assumptionId: l.assumption_id, stakeholderIds: [l.primary, l.secondary].filter((id): id is string => !!id) })),
      ...proposal.no_fit.filter((m) => picked.has(m.assumption_id)).map((m) => ({ assumptionId: m.assumption_id, stakeholderIds: [] as string[] })),
    ];
    if (!updates.length) return;
    apply.mutate(updates);
  }

  const heavy = proposal?.load.filter((l) => l.primary_count > 8) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !proposal && !propose.isPending) propose.mutate();
        if (!next) setProposal(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={stakeholders.length === 0 || assumptions.length === 0}>Suggest who to ask</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" title="Who can give evidence" description="These are proposed links. Nothing changes until you apply a selection. Status, wording and evidence stay as they are.">
        {propose.isPending && <p className="text-sm text-muted-foreground">Reading the assumptions and roles…</p>}
        {proposal && (
          <div className="space-y-4">
            <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
              {proposal.links.map((l) => (
                <li key={l.assumption_id} className="rounded-md border p-3 text-sm">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={picked.has(l.assumption_id)}
                      onChange={() => setPicked((cur) => {
                        const next = new Set(cur);
                        next.has(l.assumption_id) ? next.delete(l.assumption_id) : next.add(l.assumption_id);
                        return next;
                      })}
                    />
                    <span>
                      <span className="font-medium">{titles.get(l.assumption_id) ?? "Assumption"}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {l.action === "keep" ? "Keep" : l.action === "add" ? "Add" : "Change"} · {roles.get(l.primary) ?? "Role"}
                        {l.secondary ? ` and ${roles.get(l.secondary) ?? "Role"}` : ""} · {l.evidence_mode.replaceAll("_", " ")} · {l.round === "round_1" ? "first round" : "queued"}
                      </span>
                      <span className="mt-1 block">{l.reason}</span>
                    </span>
                  </label>
                </li>
              ))}
              {proposal.no_fit.map((m) => (
                <li key={m.assumption_id} className="rounded-md border p-3 text-sm">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={picked.has(m.assumption_id)}
                      onChange={() => setPicked((cur) => {
                        const next = new Set(cur);
                        next.has(m.assumption_id) ? next.delete(m.assumption_id) : next.add(m.assumption_id);
                        return next;
                      })}
                    />
                    <span>
                      <span className="font-medium">{titles.get(m.assumption_id) ?? "Assumption"}</span>
                      <span className="mt-1 block text-muted-foreground">No fitting role. Checking this clears its links. Better method: {m.better_method.replaceAll("_", " ")}.</span>
                      <span className="mt-1 block">{m.reason}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {heavy.length > 0 && <p className="text-sm text-muted-foreground">{heavy.map((l) => `${roles.get(l.stakeholder_id) ?? "A role"} is primary for ${l.primary_count} assumptions.`).join(" ")} The notes suggest what could move. Nothing was moved.</p>}
            {proposal.missing_roles.length > 0 && (
              <div className="text-sm">
                <p className="font-medium">Missing roles</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {proposal.missing_roles.map((r) => (
                    <li key={r.role}>{r.role}. {r.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            {proposal.notes.length > 0 && <ul className="list-disc pl-5 text-sm text-muted-foreground">{proposal.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => propose.mutate()} disabled={propose.isPending || apply.isPending}>Suggest again</Button>
              <Button onClick={confirm} disabled={apply.isPending || picked.size === 0}>{apply.isPending ? "Saving…" : `Apply ${picked.size}`}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
