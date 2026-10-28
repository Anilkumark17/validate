"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { CATEGORIES, categoryLabel, riskOf, STATUS_LABEL, type Status } from "@/lib/board/constants";
import { refreshBoard, type AssumptionDetail, type BoardAssumption, type BoardStakeholder } from "@/lib/board/client";
import { ALLOWED } from "@/lib/board/transitions";
import { RiskBadge, StatusBadge } from "./badges";
import { EvidenceForm } from "./evidence-form";

const INTERP_STYLE = { supports: "text-positive", contradicts: "text-destructive", inconclusive: "text-muted-foreground" } as const;

function DetailsTab({ projectId, a, onMove }: { projectId: string; a: BoardAssumption; onMove: (to: Status) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [impact, setImpact] = useState(a.impact);
  const [uncertainty, setUncertainty] = useState(a.uncertainty);
  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => api<AssumptionDetail>(`/projects/${projectId}/assumptions/${a.id}`, { method: "PATCH", json: v }),
    onSuccess: () => {
      toast.success("Assumption updated");
      refreshBoard(qc, projectId);
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/projects/${projectId}/assumptions/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Assumption deleted");
      refreshBoard(qc, projectId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!editing) {
    const rows: [string, string][] = [
      ["Description", a.description],
      ["Rationale (a model explanation, not evidence)", a.rationale],
      ["Validation method", a.validationMethod],
      ["Experiment", a.experimentDescription],
      ["Success criteria (proposed before research)", a.successCriteria],
    ];
    return (
      <div className="space-y-4 p-6 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={a.status} />
          <RiskBadge risk={a.risk} />
          <span className="text-xs text-muted-foreground">Impact {a.impact} · Uncertainty {a.uncertainty}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{categoryLabel(a.category)}</span>
          {a.provisional && <span className="rounded bg-warning-tint px-1.5 py-0.5 text-xs text-warning" title="Depends on an audience that has not been confirmed">Provisional audience</span>}
          <span className="text-xs text-muted-foreground">{a.source === "ai_generated" ? "AI-generated" : "Added by you"}</span>
          {a.confidence != null && <span className="text-xs text-muted-foreground">Confidence {a.confidence}%</span>}
        </div>
        {rows.map(([k, v]) => v && (
          <div key={k}>
            <h3 className="text-xs font-medium text-muted-foreground">{k}</h3>
            <p className="whitespace-pre-wrap">{v}</p>
          </div>
        ))}
        {a.validationQuestions.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Neutral questions to ask</h3>
            <ul className="list-disc pl-5">
              {a.validationQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <div>
            <Label htmlFor="as-move">Move to</Label>
            <Select id="as-move" value="" onChange={(e) => e.target.value && onMove(e.target.value as Status)}>
              <option value="">Choose a status…</option>
              {ALLOWED[a.status].map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          {a.status === "generated" && a.evidenceCount === 0 && (
            <Button variant="ghost" onClick={() => confirm("Delete this assumption?") && remove.mutate()} disabled={remove.isPending}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <form
      className="space-y-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const conf = String(f.get("confidence") ?? "").trim();
        save.mutate({
          title: f.get("title"),
          description: f.get("description"),
          category: String(f.get("category")).trim().toLowerCase().replace(/\s+/g, "_"),
          rationale: f.get("rationale"),
          impact,
          uncertainty,
          confidence: conf === "" ? null : Number(conf),
          validationMethod: f.get("validationMethod"),
          validationQuestions: String(f.get("validationQuestions") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
          experimentDescription: f.get("experimentDescription"),
          successCriteria: f.get("successCriteria"),
        });
      }}
    >
      <div>
        <Label htmlFor="e-title">Title</Label>
        <Input id="e-title" name="title" defaultValue={a.title} required minLength={8} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="e-desc">Description</Label>
        <Textarea id="e-desc" name="description" defaultValue={a.description} maxLength={600} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="e-cat">Category</Label>
          <Input id="e-cat" name="category" list="categories" defaultValue={a.category} required />
          <datalist id="categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="e-imp">Impact (1-5)</Label>
          <Select id="e-imp" value={impact} onChange={(e) => setImpact(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="e-unc">Uncertainty (1-5)</Label>
          <Select id="e-unc" value={uncertainty} onChange={(e) => setUncertainty(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="e-conf">Confidence % (optional)</Label>
          <Input id="e-conf" name="confidence" type="number" min={0} max={100} defaultValue={a.confidence ?? ""} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Risk = impact x uncertainty = <strong>{riskOf(impact, uncertainty)}</strong> (the server recalculates it).</p>
      <div>
        <Label htmlFor="e-rat">Rationale</Label>
        <Textarea id="e-rat" name="rationale" defaultValue={a.rationale} maxLength={600} />
      </div>
      <div>
        <Label htmlFor="e-method">Validation method</Label>
        <Input id="e-method" name="validationMethod" defaultValue={a.validationMethod} maxLength={200} />
      </div>
      <div>
        <Label htmlFor="e-q">Neutral questions (one per line, about past behavior)</Label>
        <Textarea id="e-q" name="validationQuestions" defaultValue={a.validationQuestions.join("\n")} rows={4} />
      </div>
      <div>
        <Label htmlFor="e-exp">Experiment</Label>
        <Textarea id="e-exp" name="experimentDescription" defaultValue={a.experimentDescription} maxLength={600} />
      </div>
      <div>
        <Label htmlFor="e-succ">Success criteria (set before validation)</Label>
        <Textarea id="e-succ" name="successCriteria" defaultValue={a.successCriteria} maxLength={500} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

function StakeholdersTab({ projectId, a, stakeholders }: { projectId: string; a: BoardAssumption; stakeholders: BoardStakeholder[] }) {
  const qc = useQueryClient();
  const [ids, setIds] = useState<string[]>(a.stakeholderIds);
  const save = useMutation({
    mutationFn: () => api(`/projects/${projectId}/assumptions/${a.id}/stakeholders`, { method: "PUT", json: { ids } }),
    onSuccess: () => {
      toast.success("Stakeholders updated");
      refreshBoard(qc, projectId);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 p-6">
      <p className="text-sm text-muted-foreground">Roles that can confirm or refute this assumption.</p>
      {stakeholders.length === 0 && <p className="text-sm">No stakeholder roles yet. Add one on the Stakeholders tab.</p>}
      <ul className="space-y-1.5">
        {stakeholders.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
              <input type="checkbox" className="mt-1" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} />
              <span>
                <span className="font-medium">{s.roleName}</span>
                <span className="block text-muted-foreground">Relevance {s.relevance}/5 · {s.interviewCount} interviews</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save links"}</Button>
    </div>
  );
}

function EvidenceTab({ projectId, a, detail, stakeholders }: { projectId: string; a: BoardAssumption; detail: AssumptionDetail | undefined; stakeholders: BoardStakeholder[] }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (eid: string) => api(`/projects/${projectId}/assumptions/${a.id}/evidence/${eid}`, { method: "DELETE" }),
    onSuccess: () => refreshBoard(qc, projectId),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4 p-6">
      <ul className="space-y-2">
        {detail?.evidence.length === 0 && <li className="text-sm text-muted-foreground">No evidence recorded yet.</li>}
        {detail?.evidence.map((ev) => (
          <li key={ev.id} className="rounded-lg border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={`font-semibold ${INTERP_STYLE[ev.interpretation]}`}>{ev.interpretation}</span>
              <span>{ev.type.replace("_", " ")}</span>
              <span>{ev.strength}</span>
              <span>{ev.researchedOn}</span>
              {ev.stakeholderRole && <span>· {ev.stakeholderRole}</span>}
              <Button size="icon" variant="ghost" className="ml-auto size-6" aria-label="Delete evidence" onClick={() => confirm("Delete this evidence?") && remove.mutate(ev.id)}>
                <Trash2 />
              </Button>
            </div>
            {ev.source && <p className="mt-1 font-medium">{ev.source}</p>}
            <p className="whitespace-pre-wrap">{ev.summary}</p>
            {ev.reference && <p className="mt-1 break-all text-xs text-muted-foreground">Ref: {ev.reference}</p>}
          </li>
        ))}
      </ul>
      <EvidenceForm projectId={projectId} assumptionId={a.id} stakeholders={stakeholders} />
    </div>
  );
}

function HistoryTab({ detail }: { detail: AssumptionDetail | undefined }) {
  return (
    <ol className="space-y-3 p-6 text-sm">
      {detail?.decisions.length === 0 && <li className="text-muted-foreground">No decisions yet. Every status change is recorded here and cannot be edited.</li>}
      {detail?.decisions.map((d) => (
        <li key={d.id} className="rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={d.fromStatus} /> → <StatusBadge status={d.toStatus} />
            <span className="ml-auto">{new Date(d.createdAt).toLocaleString()}{d.actorName ? ` · ${d.actorName}` : ""}</span>
          </div>
          <p className="mt-1">{d.rationale}</p>
          {d.interpretation && <p className="mt-1 text-muted-foreground">Interpretation: {d.interpretation}</p>}
          {d.evidenceIds.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Based on {d.evidenceIds.length} evidence record{d.evidenceIds.length === 1 ? "" : "s"}</p>}
        </li>
      ))}
    </ol>
  );
}

export function AssumptionDialog({
  projectId,
  assumption,
  stakeholders,
  onClose,
  onMove,
}: {
  projectId: string;
  assumption: BoardAssumption;
  stakeholders: BoardStakeholder[];
  onClose: () => void;
  onMove: (to: Status) => void;
}) {
  const detail = useQuery({
    queryKey: ["assumption", projectId, assumption.id],
    queryFn: () => api<AssumptionDetail>(`/projects/${projectId}/assumptions/${assumption.id}`),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" title={assumption.title} description={`Risk ${assumption.risk ?? "?"} of 25`}>
        <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="stakeholders">Stakeholders ({assumption.stakeholderIds.length})</TabsTrigger>
            <TabsTrigger value="evidence">Evidence ({assumption.evidenceCount})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="details"><DetailsTab projectId={projectId} a={assumption} onMove={onMove} /></TabsContent>
          <TabsContent value="stakeholders"><StakeholdersTab projectId={projectId} a={assumption} stakeholders={stakeholders} /></TabsContent>
          <TabsContent value="evidence"><EvidenceTab projectId={projectId} a={assumption} detail={detail.data} stakeholders={stakeholders} /></TabsContent>
          <TabsContent value="history"><HistoryTab detail={detail.data} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
