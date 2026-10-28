"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { PRIORITIES } from "@/lib/board/constants";
import { refreshBoard, type BoardAssumption, type BoardStakeholder } from "@/lib/board/client";

/** Create or edit a stakeholder ROLE and choose which assumptions it helps validate. */
export function StakeholderDialog({ projectId, stakeholder, assumptions, variant = "default" }: { projectId: string; stakeholder?: BoardStakeholder; assumptions: BoardAssumption[]; variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {stakeholder ? (
          <Button size="icon" variant="ghost" aria-label={`Edit ${stakeholder.roleName}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant={variant}>
            <Plus /> Add stakeholder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={stakeholder ? "Edit stakeholder role" : "Add a stakeholder role"} description="A role such as “parents who plan family meals”, not a named person.">
        {open && <Form projectId={projectId} stakeholder={stakeholder} assumptions={assumptions} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ projectId, stakeholder, assumptions, onDone }: { projectId: string; stakeholder?: BoardStakeholder; assumptions: BoardAssumption[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [linked, setLinked] = useState<string[]>(stakeholder?.assumptionIds ?? []);
  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      if (!stakeholder) return api(`/projects/${projectId}/stakeholders`, { method: "POST", json: { ...v, assumptionIds: linked } });
      await api(`/projects/${projectId}/stakeholders/${stakeholder.id}`, { method: "PATCH", json: v });
      return api(`/projects/${projectId}/stakeholders/${stakeholder.id}/assumptions`, { method: "PUT", json: { ids: linked } });
    },
    onSuccess: () => {
      toast.success(stakeholder ? "Stakeholder updated" : "Stakeholder added");
      refreshBoard(qc, projectId);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save.mutate({
          roleName: f.get("roleName"),
          description: f.get("description"),
          whyItMatters: f.get("whyItMatters"),
          relevance: Number(f.get("relevance")),
          interviewPriority: f.get("interviewPriority"),
          recruitmentCriteria: f.get("recruitmentCriteria"),
          interviewQuestions: String(f.get("interviewQuestions") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
          expectedEvidence: f.get("expectedEvidence"),
        });
      }}
    >
      <div>
        <Label htmlFor="s-role">Role</Label>
        <Input id="s-role" name="roleName" required minLength={3} maxLength={120} defaultValue={stakeholder?.roleName} autoFocus />
      </div>
      <div>
        <Label htmlFor="s-desc">Description</Label>
        <Textarea id="s-desc" name="description" maxLength={500} defaultValue={stakeholder?.description} />
      </div>
      <div>
        <Label htmlFor="s-why">Why this role matters</Label>
        <Textarea id="s-why" name="whyItMatters" maxLength={500} defaultValue={stakeholder?.whyItMatters} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="s-rel">Relevance (1-5)</Label>
          <Select id="s-rel" name="relevance" defaultValue={stakeholder?.relevance ?? 3}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>
        </div>
        <div>
          <Label htmlFor="s-pri">Interview priority</Label>
          <Select id="s-pri" name="interviewPriority" defaultValue={stakeholder?.interviewPriority ?? "medium"}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select>
        </div>
      </div>
      <div>
        <Label htmlFor="s-rec">Recruitment criteria</Label>
        <Textarea id="s-rec" name="recruitmentCriteria" maxLength={500} defaultValue={stakeholder?.recruitmentCriteria} />
      </div>
      <div>
        <Label htmlFor="s-q">Interview questions (one per line, about past behavior)</Label>
        <Textarea id="s-q" name="interviewQuestions" rows={3} defaultValue={stakeholder?.interviewQuestions.join("\n")} />
      </div>
      <div>
        <Label htmlFor="s-ev">Expected evidence</Label>
        <Textarea id="s-ev" name="expectedEvidence" maxLength={500} defaultValue={stakeholder?.expectedEvidence} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Assumptions this role helps validate</legend>
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
          {assumptions.length === 0 && <p className="text-xs text-muted-foreground">No assumptions yet.</p>}
          {assumptions.map((a) => (
            <label key={a.id} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={linked.includes(a.id)} onChange={(e) => setLinked(e.target.checked ? [...linked, a.id] : linked.filter((x) => x !== a.id))} />
              <span>{a.title}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
