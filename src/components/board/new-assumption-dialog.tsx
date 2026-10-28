"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { api } from "@/lib/api";
import { CATEGORIES, riskOf } from "@/lib/board/constants";
import { refreshBoard, type BoardStakeholder } from "@/lib/board/client";

export function NewAssumptionDialog({ projectId, stakeholders }: { projectId: string; stakeholders: BoardStakeholder[] }) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState(3);
  const [uncertainty, setUncertainty] = useState(3);
  const [linked, setLinked] = useState<string[]>([]);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => api(`/projects/${projectId}/assumptions`, { method: "POST", json: v }),
    onSuccess: () => {
      toast.success("Assumption added");
      refreshBoard(qc, projectId);
      setOpen(false);
      setLinked([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add assumption
        </Button>
      </DialogTrigger>
      <DialogContent title="Add an assumption" description="One clear belief that could be wrong. It starts in Generated.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({
              title: f.get("title"),
              description: f.get("description"),
              category: String(f.get("category")).trim().toLowerCase().replace(/\s+/g, "_"),
              impact,
              uncertainty,
              validationMethod: f.get("validationMethod"),
              validationQuestions: String(f.get("questions") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
              successCriteria: f.get("successCriteria"),
              stakeholderIds: linked,
            });
          }}
        >
          <div>
            <Label htmlFor="n-title">Assumption</Label>
            <Input id="n-title" name="title" required minLength={8} maxLength={200} placeholder="Parents struggle to decide what to cook on weeknights" autoFocus />
          </div>
          <div>
            <Label htmlFor="n-desc">Description</Label>
            <Textarea id="n-desc" name="description" maxLength={600} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="n-cat">Category</Label>
              <Input id="n-cat" name="category" list="n-categories" defaultValue="problem_severity" required />
              <datalist id="n-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label htmlFor="n-imp">Impact</Label>
              <Select id="n-imp" value={impact} onChange={(e) => setImpact(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>
            </div>
            <div>
              <Label htmlFor="n-unc">Uncertainty</Label>
              <Select id="n-unc" value={uncertainty} onChange={(e) => setUncertainty(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Risk = {riskOf(impact, uncertainty)} (impact x uncertainty)</p>
          <div>
            <Label htmlFor="n-method">Validation method</Label>
            <Input id="n-method" name="validationMethod" maxLength={200} placeholder="Customer interviews" />
          </div>
          <div>
            <Label htmlFor="n-q">Neutral questions (one per line)</Label>
            <Textarea id="n-q" name="questions" rows={3} placeholder="Tell me about the last time you ..." />
          </div>
          <div>
            <Label htmlFor="n-succ">Success criteria, set before research</Label>
            <Textarea id="n-succ" name="successCriteria" maxLength={500} />
          </div>
          {stakeholders.length > 0 && (
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Stakeholder roles</legend>
              <div className="flex flex-wrap gap-2">
                {stakeholders.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                    <input type="checkbox" checked={linked.includes(s.id)} onChange={(e) => setLinked(e.target.checked ? [...linked, s.id] : linked.filter((x) => x !== s.id))} />
                    {s.roleName}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
